'use client';

import { isLockEnabled, verifyPin } from '@/lib/app-lock';

/**
 * Per-chat lock for sensitive conversations. A locked chat requires the same
 * PIN as the app lock to open, and its preview is masked in the chat list.
 * The locked set lives on-device (localStorage); verification reuses the
 * app-lock PIN (no separate secret). Locking a chat therefore needs the app
 * lock (a PIN) to be set up first.
 */

const KEY = 'toky.chatlock.ids';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function write(ids: Set<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(ids))); } catch { /* ignore */ }
}

/** Chat locking is available only once a PIN (app lock) exists. */
export function isChatLockAvailable(): boolean {
  return isLockEnabled();
}

export function isChatLocked(chatId: string): boolean {
  return read().has(chatId);
}

export function lockChat(chatId: string): void {
  const ids = read();
  ids.add(chatId);
  write(ids);
}

export function unlockChat(chatId: string): void {
  const ids = read();
  ids.delete(chatId);
  write(ids);
}

/** Verify the PIN to open a locked chat (same PIN as the app lock). */
export function verifyChatPin(pin: string): Promise<boolean> {
  return verifyPin(pin);
}
