'use client';

/**
 * Remembers which festive messages have already played their celebration on
 * this device, so a message celebrates exactly once — the first time you see
 * it (i.e. when you read it) — and never replays when you reopen the chat.
 * Capped and best-effort; failures are ignored (private mode, blocked storage).
 */

const KEY = 'toky_fx_seen_v1';
const CAP = 300;

function read(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function wasCelebrated(id: string): boolean {
  return read().includes(id);
}

export function markCelebrated(id: string): void {
  try {
    const a = read();
    if (a.includes(id)) return;
    a.push(id);
    const trimmed = a.length > CAP ? a.slice(a.length - CAP) : a;
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}
