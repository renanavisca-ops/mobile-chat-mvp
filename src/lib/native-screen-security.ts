'use client';

/**
 * Screenshot protection bridge (ScreenSecurity plugin — Android FLAG_SECURE).
 *
 * The preference lives on-device (localStorage). When on, the native layer sets
 * FLAG_SECURE so Android blocks screenshots and screen recording. It's a no-op
 * on iOS (no OS API to block captures) and on the web (not possible there) —
 * the toggle still saves, so it takes effect wherever the capability exists.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

interface ScreenSecurityPlugin {
  setSecure(opts: { enabled: boolean }): Promise<void>;
}

const ScreenSecurity = registerPlugin<ScreenSecurityPlugin>('ScreenSecurity');

const KEY = 'toky.screenSecurity';

export function canScreenSecurity(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ScreenSecurity');
}

export function isScreenSecurityOn(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** Persist the preference and apply it to the native window if available. */
export async function setScreenSecurity(enabled: boolean): Promise<void> {
  try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
  await applyScreenSecurity(enabled);
}

/** Push the current (or given) preference to the native layer. Safe anywhere. */
export async function applyScreenSecurity(enabled = isScreenSecurityOn()): Promise<void> {
  if (!canScreenSecurity()) return;
  try { await ScreenSecurity.setSecure({ enabled }); } catch { /* ignore */ }
}
