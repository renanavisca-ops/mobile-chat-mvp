'use client';

/**
 * On-device cache for decrypted chat media (images, video, audio, files).
 *
 * Encrypted attachments live at an immutable, unique storage path, so once we
 * download + decrypt one we can keep the plaintext bytes and skip the round-trip
 * (download + decrypt) on every future open. Without this, previously-sent
 * photos reload each time a chat is opened.
 *
 * Uses the Cache Storage API (large quota, async, survives app restarts). Same
 * E2EE-at-rest tradeoff as the message cache; cleared on sign-out.
 */

const MEDIA_CACHE = 'toky-media-v1';

// A synthetic same-origin-ish key for the Cache Storage entry.
function keyFor(path: string): string {
  return `https://toky-media-cache/${encodeURIComponent(path)}`;
}

export async function getCachedMedia(path: string): Promise<Blob | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const res = await cache.match(keyFor(path));
    if (res) return await res.blob();
  } catch {}
  return null;
}

export async function putCachedMedia(path: string, blob: Blob): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(MEDIA_CACHE);
    await cache.put(
      keyFor(path),
      new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }),
    );
  } catch {}
}

/** Drop all cached media (call on sign-out / account deletion). */
export async function clearMediaCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(MEDIA_CACHE);
  } catch {}
}
