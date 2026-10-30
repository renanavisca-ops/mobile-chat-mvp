'use client';

/**
 * On-device organization for the user's stickers: favorites and named packs.
 *
 * Stickers themselves live in the `stickers/<userId>/` storage folder (see
 * lib/db/stickers). There's no server table for grouping, so favorites and
 * packs are kept locally (localStorage), keyed by the sticker's storage path.
 * A sticker belongs to at most one custom pack; "Favorites" is a cross-cutting
 * flag. Unknown/removed paths are harmless — they just never match a sticker.
 */

const FAV_KEY = 'toky.stickers.fav';
const PACKS_KEY = 'toky.stickers.packs';
const MAP_KEY = 'toky.stickers.packmap';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private */ }
}

/* --------------------------------- Favorites -------------------------------- */

export function getFavorites(): Set<string> {
  return new Set(readJson<string[]>(FAV_KEY, []));
}
export function isFavorite(path: string): boolean {
  return getFavorites().has(path);
}
/** Toggle and return the new favorite state. */
export function toggleFavorite(path: string): boolean {
  const favs = getFavorites();
  let on: boolean;
  if (favs.has(path)) { favs.delete(path); on = false; } else { favs.add(path); on = true; }
  writeJson(FAV_KEY, Array.from(favs));
  return on;
}

/* ----------------------------------- Packs ---------------------------------- */

export function getPacks(): string[] {
  return readJson<string[]>(PACKS_KEY, []);
}
export function createPack(name: string): void {
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  const packs = getPacks();
  if (!packs.includes(clean)) writeJson(PACKS_KEY, [...packs, clean]);
}
export function deletePack(name: string): void {
  writeJson(PACKS_KEY, getPacks().filter((p) => p !== name));
  const map = getPackMap();
  let changed = false;
  for (const [path, pack] of Object.entries(map)) {
    if (pack === name) { delete map[path]; changed = true; }
  }
  if (changed) writeJson(MAP_KEY, map);
}

export function getPackMap(): Record<string, string> {
  return readJson<Record<string, string>>(MAP_KEY, {});
}
export function getPackOf(path: string): string | null {
  return getPackMap()[path] ?? null;
}
/** Assign a sticker to a pack, or pass null to remove it from its pack. */
export function setPackOf(path: string, pack: string | null): void {
  const map = getPackMap();
  if (pack) map[path] = pack;
  else delete map[path];
  writeJson(MAP_KEY, map);
}
