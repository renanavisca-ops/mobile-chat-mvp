'use client';

/**
 * Local app lock (PIN). The app can require a PIN on launch and after it has
 * been in the background past a timeout. Only a salted SHA-256 hash of the PIN
 * is stored on-device (never the PIN itself, never the server). This is a
 * device-level convenience lock, not account security.
 *
 * Biometric unlock needs a native plugin (future build); this ships the PIN
 * path, which works on web/Android/iOS today.
 */

const ENABLED = 'toky.lock.enabled';
const HASH = 'toky.lock.hash';
const SALT = 'toky.lock.salt';
const TIMEOUT = 'toky.lock.timeout'; // seconds of background before re-locking
const BG_AT = 'toky.lock.bgAt';

export const AUTO_LOCK_OPTIONS = [0, 60, 300, 900, 3600]; // 0 = immediately

export function isLockEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED) === '1' && !!localStorage.getItem(HASH);
  } catch {
    return false;
  }
}

export function getAutoLockSeconds(): number {
  try {
    const v = Number(localStorage.getItem(TIMEOUT));
    return AUTO_LOCK_OPTIONS.includes(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function setAutoLockSeconds(s: number): void {
  try { localStorage.setItem(TIMEOUT, String(s)); } catch { /* ignore */ }
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return hex(digest);
}

/** Set (or change) the PIN and enable the lock. */
export async function setPin(pin: string): Promise<void> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const h = await hashPin(pin, salt);
  try {
    localStorage.setItem(SALT, salt);
    localStorage.setItem(HASH, h);
    localStorage.setItem(ENABLED, '1');
  } catch { /* ignore */ }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const salt = localStorage.getItem(SALT);
    const h = localStorage.getItem(HASH);
    if (!salt || !h) return false;
    return (await hashPin(pin, salt)) === h;
  } catch {
    return false;
  }
}

/** Turn the lock off and forget the PIN. */
export function disableLock(): void {
  try {
    localStorage.removeItem(ENABLED);
    localStorage.removeItem(HASH);
    localStorage.removeItem(SALT);
    localStorage.removeItem(BG_AT);
  } catch { /* ignore */ }
}

/** Record that the app went to the background (for the auto-lock timer). */
export function markBackgrounded(): void {
  try { localStorage.setItem(BG_AT, String(Date.now())); } catch { /* ignore */ }
}

/** Whether returning to the foreground now should re-lock the app. */
export function shouldLockOnResume(): boolean {
  if (!isLockEnabled()) return false;
  const timeout = getAutoLockSeconds();
  if (timeout === 0) return true;
  try {
    const at = Number(localStorage.getItem(BG_AT));
    if (!at) return false;
    return Date.now() - at >= timeout * 1000;
  } catch {
    return false;
  }
}
