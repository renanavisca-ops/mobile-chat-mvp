'use client';

/**
 * Tiny zero-dependency client cache for a stale-while-revalidate UX: paint the
 * last-known data instantly, then refresh in the background. No new deps.
 *
 * Two tiers:
 *  - memory  (`memGet`/`memSet`): lives for the tab session only. Used for
 *    decrypted message history and signed media URLs so we never write
 *    end-to-end-encrypted plaintext to disk.
 *  - persistent (`getCached`/`setCached`): memory + localStorage, survives an
 *    app restart. Used for lower-sensitivity, first-paint data (the chat list).
 *
 * Everything is namespaced and wiped on sign-out via `clearCache()`.
 */

const PREFIX = 'toky:cache:';
const mem = new Map<string, unknown>();

export function memGet<T>(key: string): T | null {
  return mem.has(key) ? (mem.get(key) as T) : null;
}

export function memSet<T>(key: string, value: T): void {
  mem.set(key, value);
}

export function getCached<T>(key: string): T | null {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) {
      const value = JSON.parse(raw) as T;
      mem.set(key, value);
      return value;
    }
  } catch {}
  return null;
}

export function setCached<T>(key: string, value: T): void {
  mem.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

/** Wipe all cached data (call on sign-out so the next user starts clean). */
export function clearCache(): void {
  mem.clear();
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {}
}
