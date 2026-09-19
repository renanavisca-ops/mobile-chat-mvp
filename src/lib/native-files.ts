'use client';

/**
 * Native file bridge for encrypted attachments.
 *
 * In an end-to-end-encrypted chat the plaintext bytes only ever exist in JS,
 * after in-memory decryption — there is no server URL to hand to the browser.
 * A stock Capacitor WebView can neither save nor open such an in-memory
 * (`blob:`) file, so the document preview's actions look dead. These helpers
 * write the decrypted bytes to the device via @capacitor/filesystem and then
 * either keep them (Download) or pass them to the Android/iOS share sheet
 * (Open / Print / Share), which can hand the file to a PDF viewer, a printer,
 * Files, Word, etc.
 *
 * All functions are native-only; callers gate on `canNativeFiles()` and keep
 * the web (blob / signed-URL) path for browsers.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';

export function canNativeFiles(): boolean {
  return Capacitor.isNativePlatform();
}

/** Strip a filename down to something safe for a filesystem path. */
function safeName(name?: string): string {
  const cleaned = (name || 'file').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 128) || 'file';
}

/** Blob → base64 (no data: prefix), which is what Filesystem.writeFile wants. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Write to the cache dir and return a shareable file URI. Cache is fine here:
 * the file only needs to live long enough for the share target to read it, and
 * the OS reclaims it later.
 */
async function writeToCache(blob: Blob, filename: string): Promise<string> {
  const data = await blobToBase64(blob);
  const path = `shared/${Date.now()}-${safeName(filename)}`;
  await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return uri;
}

/**
 * Hand the decrypted file to the native share sheet. Powers the explicit
 * "Reenviar/Share" action — the sheet lets the user send it to another app.
 */
export async function shareNativeFile(blob: Blob, filename: string, dialogTitle?: string): Promise<void> {
  const uri = await writeToCache(blob, filename);
  await Share.share({ title: filename, files: [uri], dialogTitle });
}

/**
 * Share plain text through the OS share sheet (native) or the Web Share API,
 * falling back to copying it to the clipboard on the web. Returns what happened
 * so the caller can show the right confirmation.
 */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ text });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch {
    // user cancelled the share sheet
    return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * OPEN (view) the decrypted file in a real viewer app via the OS "open with"
 * action (Android ACTION_VIEW), NOT the share sheet — so tapping "Abrir" opens
 * the document (PDF viewer, Word, Excel…) instead of offering to send it.
 *
 * Uses @capacitor-community/file-opener, loaded dynamically so the web build and
 * any already-installed app WITHOUT the native plugin (an older .aab that hasn't
 * been rebuilt with it yet) simply reject here — the caller catches that and
 * falls back to a web viewer / a "download first" hint. Once the app is rebuilt
 * with the plugin (next .aab), this opens files natively.
 */
export async function openNativeFile(blob: Blob, filename: string, mime?: string): Promise<void> {
  const { FileOpener } = await import('@capacitor-community/file-opener');
  const uri = await writeToCache(blob, filename);
  await FileOpener.open({ filePath: uri, contentType: mime || undefined });
}

/**
 * Persist the decrypted file to the device's Documents so it survives after the
 * app closes. Powers Download for documents. Returns the saved file's URI.
 */
export async function saveNativeFile(blob: Blob, filename: string): Promise<string> {
  const data = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({
    path: safeName(filename),
    data,
    directory: Directory.Documents,
    recursive: true,
  });
  return uri;
}

/**
 * Save a decrypted photo or video to the device's photo gallery (Android
 * MediaStore / iOS Photos) so it shows up in the camera roll — not just in the
 * Files app. Documents keep using saveNativeFile (Documents dir); this is only
 * for image/* and video/* attachments. We first materialize the bytes to a
 * cache file, then hand its URI to the Media plugin, which inserts it into the
 * gallery with the right permissions per OS/version.
 */
export async function saveMediaToGallery(blob: Blob, filename: string): Promise<void> {
  const uri = await writeToCache(blob, filename);
  const isVideo = (blob.type || '').toLowerCase().startsWith('video/');
  if (isVideo) {
    await Media.saveVideo({ path: uri, fileName: safeName(filename) });
  } else {
    await Media.savePhoto({ path: uri, fileName: safeName(filename) });
  }
}
