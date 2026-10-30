'use client';

/**
 * Auto-download preferences for received media, by network type and content
 * type (WhatsApp-style). When a media kind is not allowed to auto-download on
 * the current network, the chat shows a tap-to-download tile instead of
 * fetching it automatically — saving mobile data.
 *
 * Preferences are global and live on-device (localStorage). Network type is
 * read from the Network Information API where available (Android WebView /
 * Chrome). Where it can't be detected (iOS WebView, most desktops) we treat the
 * connection as Wi-Fi, so behaviour there is unchanged (everything downloads).
 */

export type MediaKind = 'photos' | 'video' | 'audio';
export type NetworkClass = 'wifi' | 'cellular';

export type AutoDownloadSettings = Record<NetworkClass, Record<MediaKind, boolean>>;

export const MEDIA_KINDS: MediaKind[] = ['photos', 'audio', 'video'];

// Default: everything on Wi-Fi (same as before); on cellular skip the heavy
// one (video) to save data, keep photos + voice notes.
export const DEFAULT_AUTODOWNLOAD: AutoDownloadSettings = {
  wifi: { photos: true, audio: true, video: true },
  cellular: { photos: true, audio: true, video: false },
};

const KEY = 'toky.autodownload';

export function getAutoDownloadSettings(): AutoDownloadSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AUTODOWNLOAD;
    const parsed = JSON.parse(raw) as Partial<AutoDownloadSettings>;
    return {
      wifi: { ...DEFAULT_AUTODOWNLOAD.wifi, ...(parsed.wifi ?? {}) },
      cellular: { ...DEFAULT_AUTODOWNLOAD.cellular, ...(parsed.cellular ?? {}) },
    };
  } catch {
    return DEFAULT_AUTODOWNLOAD;
  }
}

export function setAutoDownloadSettings(s: AutoDownloadSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota */
  }
}

/** Best-effort current network class; unknown resolves to 'wifi'. */
export function getNetworkClass(): NetworkClass {
  try {
    const c = (navigator as unknown as { connection?: { type?: string } }).connection;
    const type = c?.type;
    if (type === 'cellular') return 'cellular';
    // 'wifi' | 'ethernet' | 'wimax' | 'none' | 'unknown' | undefined → treat as Wi-Fi.
  } catch {
    /* no Network Information API */
  }
  return 'wifi';
}

/** Subscribe to network-type changes; returns an unsubscribe function. */
export function onNetworkChange(cb: () => void): () => void {
  try {
    const c = (navigator as unknown as { connection?: EventTarget }).connection;
    if (c && typeof c.addEventListener === 'function') {
      c.addEventListener('change', cb);
      return () => c.removeEventListener('change', cb);
    }
  } catch {
    /* ignore */
  }
  return () => {};
}

export function isAutoDownloadAllowed(
  kind: MediaKind,
  net: NetworkClass,
  settings: AutoDownloadSettings,
): boolean {
  return !!settings[net]?.[kind];
}
