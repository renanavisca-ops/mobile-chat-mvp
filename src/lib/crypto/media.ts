/**
 * toky-media-v1 — application-layer encryption for chat attachments.
 *
 * Each media object gets its OWN fresh random AES-GCM-256 key and 96-bit IV
 * (single-shot AEAD over the whole file). The per-object key + IV + metadata
 * travel inside the already-E2E-sealed message payload, so Supabase Storage only
 * ever receives ciphertext and the key is never exposed to the server. See
 * docs/MEDIA_ENCRYPTION.md for the versioned format.
 *
 * Single-shot (not chunked) by design: simple and safe. Files are therefore
 * capped at MAX_ENC_MEDIA_BYTES so they fit in memory; larger files must be
 * rejected by callers (a reviewed chunked v2 would be required for those).
 */

import { bytesToB64, b64ToBytes } from './e2ee';

/** Memory-safe cap for single-shot encryption (25 MB). */
export const MAX_ENC_MEDIA_BYTES = 25 * 1024 * 1024;

/** Per-object encryption metadata carried inside the sealed message payload. */
export type MediaEnc = {
  v: 1;
  alg: 'AES-GCM';
  /** base64 raw 256-bit key */
  k: string;
  /** base64 96-bit IV */
  iv: string;
  /** plaintext byte length (for display / validation) */
  size: number;
  /** original MIME type */
  mime: string;
};

function isValidMeta(enc: unknown): enc is MediaEnc {
  const e = enc as MediaEnc;
  return !!e && e.v === 1 && e.alg === 'AES-GCM' && typeof e.k === 'string' && typeof e.iv === 'string';
}

/**
 * Encrypt a file/blob with a fresh key. Returns the ciphertext blob to upload
 * and the metadata (key/iv/size/mime) to embed in the sealed message payload.
 */
export async function encryptMedia(file: Blob): Promise<{ cipher: Blob; enc: MediaEnc }> {
  if (file.size > MAX_ENC_MEDIA_BYTES) {
    const mb = Math.floor(MAX_ENC_MEDIA_BYTES / (1024 * 1024));
    throw new Error(`This file is too large to send in an encrypted chat (max ${mb} MB).`);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = await file.arrayBuffer();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const raw = await crypto.subtle.exportKey('raw', key);
  return {
    cipher: new Blob([ct], { type: 'application/octet-stream' }),
    enc: {
      v: 1,
      alg: 'AES-GCM',
      k: bytesToB64(raw),
      iv: bytesToB64(iv),
      size: file.size,
      mime: file.type || 'application/octet-stream',
    },
  };
}

/**
 * Decrypt ciphertext bytes back to a Blob of the original MIME type. Validates
 * the metadata before use; AES-GCM's tag makes a wrong key / tampering throw.
 */
export async function decryptMedia(cipherBytes: ArrayBuffer, enc: MediaEnc): Promise<Blob> {
  if (!isValidMeta(enc)) throw new Error('Unsupported or missing media encryption metadata.');
  const key = await crypto.subtle.importKey('raw', b64ToBytes(enc.k), { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(enc.iv) }, key, cipherBytes);
  return new Blob([pt], { type: enc.mime || 'application/octet-stream' });
}
