'use client';

/**
 * Chat wallpaper presets. Stored per-device in localStorage and applied as the
 * background of the messages area. `css` is any valid CSS `background` value
 * ('' means "use the app default").
 */
export type Wallpaper = { id: string; name: string; css: string };

export const WALLPAPERS: Wallpaper[] = [
  { id: 'default', name: 'Default', css: '' },
  { id: 'slate', name: 'Slate', css: '#0b0f17' },
  { id: 'midnight', name: 'Midnight', css: 'linear-gradient(160deg,#0b1220,#131a2e 60%,#0b1220)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(160deg,#082f34,#0d4652 60%,#06232a)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(160deg,#0c241b,#12362a 60%,#0a1f18)' },
  { id: 'grape', name: 'Grape', css: 'linear-gradient(160deg,#1e1140,#33205f 60%,#160d33)' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(160deg,#3a1030,#5a1b3a 55%,#241026)' },
  { id: 'ember', name: 'Ember', css: 'linear-gradient(160deg,#2a1206,#4a2110 60%,#1c0c04)' },
];

const KEY = 'toky_chat_wallpaper';

export function getWallpaperId(): string {
  try {
    return localStorage.getItem(KEY) || 'default';
  } catch {
    return 'default';
  }
}

export function setWallpaperId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore storage failures
  }
}

export function wallpaperCss(id: string): string {
  return WALLPAPERS.find((w) => w.id === id)?.css ?? '';
}
