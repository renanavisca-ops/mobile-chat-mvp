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
 * Hand the decrypted file to the native share sheet. Powers Open / Print /
 * Share — the sheet lets the user view it in a real app, print, or save it.
 */
export async function shareNativeFile(blob: Blob, filename: string, dialogTitle?: string): Promise<void> {
  const uri = await writeToCache(blob, filename);
  await Share.share({ title: filename, files: [uri], dialogTitle });
}

/**
 * Persist the decrypted file to the device's Documents so it survives after the
 * app closes. Powers Download. Returns the saved file's URI for a confirmation.
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
