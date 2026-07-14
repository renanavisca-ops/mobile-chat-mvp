'use client';

import { browserSupabase } from '@/lib/supabase/client';

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
const CUSTOM_PATH_KEY = 'toky_chat_wallpaper_custom_path';
export const CUSTOM_WALLPAPER_ID = 'custom';

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

/** Upload a personal wallpaper photo to the private `wallpapers` bucket. */
export async function uploadCustomWallpaper(userId: string, file: File): Promise<void> {
  const supabase = browserSupabase();

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('wallpapers').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;

  try {
    localStorage.setItem(CUSTOM_PATH_KEY, path);
  } catch {
    // ignore
  }
  setWallpaperId(CUSTOM_WALLPAPER_ID);
}

/** Signed URL for the current device's custom wallpaper, if one is set. */
export async function getCustomWallpaperUrl(): Promise<string | null> {
  let path: string | null = null;
  try {
    path = localStorage.getItem(CUSTOM_PATH_KEY);
  } catch {
    return null;
  }
  if (!path) return null;

  const supabase = browserSupabase();
  const { data, error } = await supabase.storage.from('wallpapers').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
