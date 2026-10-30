'use client';

/**
 * Thin wrapper over the web Permissions API so Settings can show and request
 * the permissions Toky uses. Works on the web and in the Android WebView; where
 * a permission can't be queried (notably iOS WKWebView), we report 'unsupported'
 * and the UI explains it's requested on first use. No native plugin required.
 */

export type PermName = 'camera' | 'microphone' | 'geolocation' | 'notifications';
export type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export async function queryPermission(name: PermName): Promise<PermState> {
  try {
    if (name === 'notifications') {
      if (typeof Notification === 'undefined') return 'unsupported';
      const p = Notification.permission;
      return p === 'default' ? 'prompt' : (p as PermState);
    }
    const perms = (navigator as unknown as { permissions?: { query: (d: { name: string }) => Promise<{ state: string }> } }).permissions;
    if (!perms?.query) return 'unsupported';
    const status = await perms.query({ name });
    return status.state as PermState;
  } catch {
    return 'unsupported';
  }
}

/** Trigger the browser/OS prompt for a permission, then report the new state. */
export async function requestPermission(name: PermName): Promise<PermState> {
  try {
    if (name === 'notifications') {
      if (typeof Notification !== 'undefined') await Notification.requestPermission();
    } else if (name === 'geolocation') {
      await new Promise<void>((resolve) =>
        navigator.geolocation.getCurrentPosition(() => resolve(), () => resolve(), { timeout: 8000 }),
      );
    } else if (name === 'camera' || name === 'microphone') {
      const stream = await navigator.mediaDevices.getUserMedia(
        name === 'camera' ? { video: true } : { audio: true },
      );
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch {
    /* user denied or cancelled */
  }
  return queryPermission(name);
}

/** Can we trigger a prompt for this permission from the web layer? */
export function isRequestable(name: PermName): boolean {
  if (name === 'notifications') return typeof Notification !== 'undefined';
  if (name === 'geolocation') return typeof navigator !== 'undefined' && !!navigator.geolocation;
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
