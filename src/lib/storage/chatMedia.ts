'use client';

import { browserSupabase } from '@/lib/supabase/client';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov (Safari / iOS)
  'video/x-matroska', // .mkv (a veces)
  'video/3gpp', // .3gp
  'video/3gpp2', // .3g2
  'video/ogg',
  'video/x-msvideo', // .avi
  'video/mpeg', // .mpeg
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB (ajústalo luego si quieres)

function sanitizeFilename(name: string) {
  let cleaned = (name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  cleaned = cleaned.replace(/^\.+/, '');
  if (!cleaned) cleaned = 'file';
  return cleaned.slice(0, 120);
}

function guessExt(mime: string) {
  switch (mime) {
    // images
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';

    // videos
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    case 'video/x-matroska':
      return 'mkv';
    case 'video/3gpp':
      return '3gp';
    case 'video/3gpp2':
      return '3g2';
    case 'video/ogg':
      return 'ogv';
    case 'video/x-msvideo':
      return 'avi';
    case 'video/mpeg':
      return 'mpeg';

    default:
      return 'bin';
  }
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

/**
 * Upload universal para chat-media (bucket privado)
 * Path: chats/<chatId>/<timestamp>_<uuid>_<safeName>.<ext>
 *
 * - kind='image' aplica allowlist + 5MB
 * - kind='video' aplica allowlist + 200MB
 *
 * Guarda SOLO path (nunca URL).
 */
export async function uploadChatMedia(input: {
  chatId: string;
  file: File;
  kind: 'image' | 'video';
}): Promise<{ path: string }> {
  const { chatId, file, kind } = input;

  const mime = file.type || '';
  const safeName = assertFilenameOk(file.name);

  if (kind === 'image') {
    if (!IMAGE_MIME.has(mime)) throw new Error(`Mime type ${mime || '(unknown)'} not supported`);
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Máximo 5MB por imagen.');
  } else {
    if (!VIDEO_MIME.has(mime)) throw new Error(`Mime type ${mime || '(unknown)'} not supported`);
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Máximo 200MB por video.');
  }

  const ts = Date.now();
  const id = crypto.randomUUID();
  const ext = guessExt(mime);

  const base = safeName.replace(/\.[^.]+$/, '');
  const finalName = `${ts}_${id}_${base}.${ext}`;

  const path = `chats/${chatId}/${finalName}`;

  const supabase = browserSupabase();
  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    upsert: false,
    contentType: mime || 'application/octet-stream',
    cacheControl: '3600',
  });

  if (error) throw error;
  return { path };
}

/** Backward-compatible: imágenes */
export async function uploadChatImage(chatId: string, file: File): Promise<{ path: string }> {
  return uploadChatMedia({ chatId, file, kind: 'image' });
}

export async function createSignedChatMediaUrl(path: string, expiresSeconds = 60 * 5): Promise<string> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}
