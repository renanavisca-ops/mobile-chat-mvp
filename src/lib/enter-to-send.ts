'use client';

/**
 * "Send with Enter" preference (per-device, like Telegram's "Send by Enter").
 *
 * Default by device: on a desktop/physical keyboard Enter sends and Shift+Enter
 * inserts a newline; on touch/mobile Enter inserts a newline and you send with
 * the send button. The user can override that default here; the choice lives
 * on-device (localStorage) so phone and desktop can differ. Ctrl/Cmd+Enter
 * always sends regardless of this setting.
 */

const KEY = 'toky.enterSends';
export const ENTER_SENDS_EVENT = 'toky:enterSends';

/** Device default: desktop (fine pointer) sends on Enter; touch/mobile doesn't. */
export function defaultEnterSends(): boolean {
  try {
    return !window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

/** Effective value: the explicit choice if set, otherwise the device default. */
export function getEnterSends(): boolean {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {
    /* ignore */
  }
  return defaultEnterSends();
}

/** Persist the choice and notify any open composer so it updates live. */
export function setEnterSends(value: boolean): void {
  try {
    window.localStorage.setItem(KEY, value ? 'on' : 'off');
    window.dispatchEvent(new Event(ENTER_SENDS_EVENT));
  } catch {
    /* ignore */
  }
}
