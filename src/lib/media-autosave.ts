'use client';

/**
 * Per-chat "Guardar en Fotos" (auto-save received media to the gallery).
 *
 * The preference and the set of already-saved message ids live on-device
 * (localStorage), keyed by chat. When the user turns it on we seed the saved
 * set with the current history so only NEW incoming media is auto-saved from
 * then on — we never dump the whole backlog into the camera roll.
 *
 * Native-only in effect (the gallery only exists on the installed app); the web
 * simply never shows the toggle.
 */

const ON_KEY = (chatId: string) => `toky.autosave.on.${chatId}`;
const IDS_KEY = (chatId: string) => `toky.autosave.ids.${chatId}`;
const MAX_IDS = 4000;

export function isAutoSaveOn(chatId: string): boolean {
  try {
    return localStorage.getItem(ON_KEY(chatId)) === '1';
  } catch {
    return false;
  }
}

export function setAutoSaveOn(chatId: string, on: boolean): void {
  try {
    localStorage.setItem(ON_KEY(chatId), on ? '1' : '0');
  } catch {
    /* private mode / quota */
  }
}

function readIds(chatId: string): Set<string> {
  try {
    const raw = localStorage.getItem(IDS_KEY(chatId));
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeIds(chatId: string, ids: Set<string>): void {
  try {
    // Keep the set bounded so it can't grow without limit.
    const arr = Array.from(ids).slice(-MAX_IDS);
    localStorage.setItem(IDS_KEY(chatId), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function isMediaSaved(chatId: string, msgId: string): boolean {
  return readIds(chatId).has(msgId);
}

export function markMediaSaved(chatId: string, msgIds: string[]): void {
  if (msgIds.length === 0) return;
  const s = readIds(chatId);
  for (const id of msgIds) s.add(id);
  writeIds(chatId, s);
}
