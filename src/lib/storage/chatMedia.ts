'use client';

import { browserSupabase } from '@/lib/supabase/client';

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

    default:
      return '';
  }
}

function pickExt(kind: 'image' | 'video', file: File) {
  const extFromName = getExtFromName(file.name);
  if (extFromName) return extFromName;

  const t = (file.type || '').toLowerCase();
  if (kind === 'image') {
    if (t === 'image/jpeg') return 'jpg';
    if (t === 'image/png') return 'png';
    if (t === 'image/webp') return 'webp';
    return 'bin';
  }

  if (t === 'video/mp4') return 'mp4';
  if (t === 'video/webm') return 'webm';
  if (t === 'video/quicktime') return 'mov';
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
  file: File;
  kind: 'image' | 'video';
}): Promise<{ path: string }> {
  const { chatId, file, kind } = input;

  const mimeRaw = (file.type || '').toLowerCase();
  const safeName = assertFilenameOk(file.name);
  const ext = pickExt(kind, file).toLowerCase();

  if (kind === 'image') {
    const okByMime = IMAGE_MIME.has(mimeRaw);
    const okByExt = IMAGE_EXT.has(ext);
    if (!okByMime && !okByExt) throw new Error(`Mime type ${mimeRaw || '(unknown)'} is not supported`);
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Máximo 5MB por imagen.');
  } else {
    // Video: NO allowlist estricta (codec no se puede validar aquí)
    if (mimeRaw && !mimeRaw.startsWith('video/')) {
      throw new Error(`Mime type ${mimeRaw || '(unknown)'} is not supported`);
    }
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Máximo 200MB por video.');
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

export async function createSignedChatMediaUrl(path: string, expiresSeconds = 60 * 5): Promise<string> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}
