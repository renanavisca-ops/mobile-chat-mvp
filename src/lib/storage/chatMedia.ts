'use client';

import { browserSupabase } from '@/lib/supabase/client';
import { encryptMedia, decryptMedia, type MediaEnc } from '@/lib/crypto/media';
import { getCachedMedia, putCachedMedia } from '@/lib/storage/media-cache';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB

function sanitizeFilename(name: string) {
  let cleaned = (name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  cleaned = cleaned.replace(/^\.+/, '');
  if (!cleaned) cleaned = 'file';
  return cleaned.slice(0, 120);
}

function getExtFromName(name: string) {
  const safe = sanitizeFilename(name);
  const m = safe.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function assertFilenameOk(fileName: string) {
  const safe = sanitizeFilename(fileName);
  const parts = safe.split('.');
  if (parts.length >= 3) {
    const last = parts[parts.length - 1].toLowerCase();
    const secondLast = parts[parts.length - 2].toLowerCase();
    const bad = new Set(['exe', 'bat', 'cmd', 'msi', 'sh', 'js', 'jar', 'com', 'scr']);
    if (bad.has(last) || bad.has(secondLast)) throw new Error('Nombre de archivo inválido.');
  }
  return safe;
}

function contentTypeFromExt(ext: string): string | '' {
  switch (ext) {
    // images
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';

    // videos
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'ogv':
      return 'video/ogg';
    case 'avi':
      return 'video/x-msvideo';
    case 'mkv':
      return 'video/x-matroska';
    case 'mpeg':
    case 'mpg':
      return 'video/mpeg';
    case '3gp':
      return 'video/3gpp';
    case '3g2':
      return 'video/3gpp2';

    // audio
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'webm':
      return 'audio/webm';
    case 'm4a':
      return 'audio/mp4';

    default:
      return '';
  }
}

function pickExt(kind: 'image' | 'video' | 'audio', file: File) {
  const extFromName = getExtFromName(file.name);
  if (extFromName) return extFromName;

  const t = (file.type || '').toLowerCase();
  if (kind === 'image') {
    if (t === 'image/jpeg') return 'jpg';
    if (t === 'image/png') return 'png';
    if (t === 'image/webp') return 'webp';
    return 'bin';
  }

  if (kind === 'video') {
    if (t === 'video/mp4') return 'mp4';
    if (t === 'video/webm') return 'webm';
    if (t === 'video/quicktime') return 'mov';
  }

  if (kind === 'audio') {
    if (t === 'audio/mpeg') return 'mp3';
    if (t === 'audio/wav') return 'wav';
    if (t === 'audio/ogg') return 'ogg';
    if (t === 'audio/webm') return 'webm';
  }

  return 'bin';
}

/**
 * Upload universal a bucket privado chat-media
 * Path: chats/<chatId>/<timestamp>_<uuid>_<safeName>.<ext>
 *
 * - Images: allowlist por mime o ext + 5MB
 * - Videos: aceptamos cualquier mime video/* (o mime vacío), + 200MB
 *
 * CLAVE: fijamos contentType por extensión si el navegador no lo trae bien.
 */
export async function uploadChatMedia(input: {
  chatId: string;
  file: File | Blob;
  kind: 'image' | 'video' | 'audio';
  name?: string;
}): Promise<{ path: string }> {
  const { chatId, file, kind, name } = input;

  const fileName = name || (file instanceof File ? file.name : `audio_${Date.now()}.webm`);
  const mimeRaw = (file.type || '').toLowerCase();
  const safeName = assertFilenameOk(fileName);
  const ext = pickExt(kind, file instanceof File ? file : new File([file], fileName, { type: file.type })).toLowerCase();

  if (kind === 'image') {
    const okByMime = IMAGE_MIME.has(mimeRaw);
    const okByExt = IMAGE_EXT.has(ext);
    if (!okByMime && !okByExt) throw new Error(`Mime type ${mimeRaw || '(unknown)'} is not supported`);
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Máximo 5MB por imagen.');
  } else if (kind === 'video') {
    // Video: NO allowlist estricta (codec no se puede validar aquí)
    if (mimeRaw && !mimeRaw.startsWith('video/')) {
      throw new Error(`Mime type ${mimeRaw || '(unknown)'} is not supported`);
    }
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Máximo 200MB por video.');
  } else if (kind === 'audio') {
    if (mimeRaw && !mimeRaw.startsWith('audio/') && !mimeRaw.startsWith('video/')) {
      // webm audio sometimes reported as video/webm in some browsers
      throw new Error(`Mime type ${mimeRaw || '(unknown)'} is not supported for audio`);
    }
  }

  const ts = Date.now();
  const id = crypto.randomUUID();
  const base = sanitizeFilename(safeName).replace(/\.[^.]+$/, '');
  const finalName = `${ts}_${id}_${base}.${ext || 'bin'}`;
  const path = `chats/${chatId}/${finalName}`;

  // ✅ Forzamos contentType estable:
  const byExt = contentTypeFromExt(ext);
  const contentType = mimeRaw || byExt || 'application/octet-stream';

  const supabase = browserSupabase();
  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    upsert: false,
    contentType,
    cacheControl: '3600',
  });

  if (error) throw error;
  return { path };
}

export async function uploadChatImage(chatId: string, file: File): Promise<{ path: string }> {
  return uploadChatMedia({ chatId, file, kind: 'image' });
}

export async function uploadChatAudio(chatId: string, file: Blob): Promise<{ path: string }> {
  return uploadChatMedia({ chatId, file, kind: 'audio', name: `audio_${Date.now()}.webm` });
}

// Reuse a freshly-signed URL for a path instead of re-signing on every chat
// reopen. Cached in memory only, and expired well before the signature does.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function createSignedChatMediaUrl(
  path: string,
  expiresSeconds = 60 * 5,
  // Pass a filename to force `Content-Disposition: attachment` so a top-level
  // navigation / window.open triggers a real download (used by the document
  // preview's Download action, which the system browser then handles).
  opts?: { download?: string | boolean },
): Promise<string> {
  // Only cache plain (inline) URLs — download-disposition URLs are one-off.
  const cacheable = !opts?.download;
  if (cacheable) {
    const hit = signedUrlCache.get(path);
    if (hit && hit.expiresAt > Date.now()) return hit.url;
  }
  const supabase = browserSupabase();
  const { data, error } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(path, expiresSeconds, opts?.download ? { download: opts.download } : undefined);
  if (error) throw error;
  if (cacheable) {
    // Expire our cache entry a minute before the signature to avoid races.
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (expiresSeconds - 60) * 1000 });
  }
  return data.signedUrl;
}

/**
 * Encrypt a file with toky-media-v1 and upload only the ciphertext to
 * chats/<chatId>/enc/. Returns the storage path plus the per-object encryption
 * metadata to embed in the (sealed) message payload. Used for encrypted chats.
 */
export async function uploadEncryptedChatMedia(input: {
  chatId: string;
  file: Blob;
}): Promise<{ path: string; enc: MediaEnc }> {
  const { chatId, file } = input;
  const { cipher, enc } = await encryptMedia(file);
  const path = `chats/${chatId}/enc/${Date.now()}_${crypto.randomUUID()}.enc`;
  const supabase = browserSupabase();
  const { error } = await supabase.storage.from('chat-media').upload(path, cipher, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  // Seed the on-device cache with the plaintext we already have, so the sender
  // doesn't re-download + re-decrypt their own attachment on the next open.
  void putCachedMedia(path, file);
  return { path, enc };
}

/**
 * Download an encrypted object via a short-lived signed URL, decrypt it in
 * memory, and return an object URL of the plaintext. The caller must
 * URL.revokeObjectURL(...) it when done.
 */
export async function fetchDecryptedMediaUrl(path: string, enc: MediaEnc): Promise<string> {
  // Serve previously-decrypted bytes from the on-device cache — no re-download,
  // no re-decrypt — so images don't reload every time a chat is opened.
  const cached = await getCachedMedia(path);
  if (cached) return URL.createObjectURL(cached);

  const signed = await createSignedChatMediaUrl(path, 300);
  const res = await fetch(signed);
  if (!res.ok) throw new Error('Could not fetch encrypted media.');
  const bytes = await res.arrayBuffer();
  const blob = await decryptMedia(bytes, enc);
  // Persist for next time (immutable path → safe to cache indefinitely).
  void putCachedMedia(path, blob);
  return URL.createObjectURL(blob);
}

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB — documents (Word/Excel/PPT/PDF)

export type UploadedFile = { path: string; name: string; size: number; mime: string };

/**
 * Upload an arbitrary document/file to the private chat-media bucket under
 * chats/<chatId>/files/. Returns metadata used to render a file card.
 */
export async function uploadChatFile(chatId: string, file: File): Promise<UploadedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Máximo 50MB por archivo.');

  const safeName = assertFilenameOk(file.name || 'file');
  const ts = Date.now();
  const id = crypto.randomUUID();
  const path = `chats/${chatId}/files/${ts}_${id}_${safeName}`;
  const contentType = file.type || 'application/octet-stream';

  const supabase = browserSupabase();
  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    upsert: false,
    contentType,
    cacheControl: '3600',
  });
  if (error) throw error;

  return { path, name: safeName, size: file.size, mime: contentType };
}
