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

/** One cached attachment: its storage path, the chat it belongs to, and size. */
export type CachedMediaItem = { path: string; chatId: string | null; size: number };

/** Recover the storage path from a cache-entry request URL. */
function pathFromKey(url: string): string | null {
  const prefix = 'https://toky-media-cache/';
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return null;
  }
}

/** Storage paths look like `chats/<chatId>/<file>`; pull out the chat id. */
function chatIdFromPath(path: string): string | null {
  const m = /(?:^|\/)chats\/([^/]+)\//.exec(path);
  return m ? m[1] : null;
}

/**
 * Enumerate everything in the on-device media cache with its size and owning
 * chat. Sizes come from the cached Blob (no byte copy), so this is cheap even
 * for large caches.
 */
export async function listCachedMedia(): Promise<CachedMediaItem[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const reqs = await cache.keys();
    const items = await Promise.all(
      reqs.map(async (req) => {
        const path = pathFromKey(req.url);
        if (!path) return null;
        let size = 0;
        try {
          const res = await cache.match(req);
          if (res) {
            const len = res.headers.get('content-length');
            size = len ? Number(len) : (await res.blob()).size;
          }
        } catch {}
        return { path, chatId: chatIdFromPath(path), size } as CachedMediaItem;
      }),
    );
    return items.filter((x): x is CachedMediaItem => x !== null);
  } catch {
    return [];
  }
}

/** Remove specific cached attachments by storage path. Returns how many went. */
export async function deleteCachedPaths(paths: string[]): Promise<number> {
  if (typeof caches === 'undefined' || paths.length === 0) return 0;
  let removed = 0;
  try {
    const cache = await caches.open(MEDIA_CACHE);
    for (const p of paths) {
      try {
        if (await cache.delete(keyFor(p))) removed++;
      } catch {}
    }
  } catch {}
  return removed;
}

/** Remove every cached attachment belonging to one chat. Returns how many. */
export async function deleteCachedForChat(chatId: string): Promise<number> {
  const all = await listCachedMedia();
  return deleteCachedPaths(all.filter((i) => i.chatId === chatId).map((i) => i.path));
}
