'use client';

// Personal sticker collection, backed entirely by the public `stickers` bucket
// (no table needed): each user's stickers live under `stickers/<userId>/`.
// Stickers are public transparent PNGs — like GIFs, they're sent as a plain URL
// and rendered without a chat bubble, so recipients load them without any key.
import { browserSupabase } from '@/lib/supabase/client';

export type Sticker = { path: string; url: string; name: string };

/** Upload a sticker PNG to the current user's folder; returns its public URL. */
export async function uploadSticker(blob: Blob): Promise<{ path: string; url: string }> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const path = `${me.user.id}/${crypto.randomUUID()}.png`;

  const { error } = await supabase.storage.from('stickers').upload(path, blob, {
    contentType: 'image/png',
    upsert: false,
    cacheControl: '31536000', // immutable (unique path) → cache a year
  });
  if (error) throw error;

  const { data } = supabase.storage.from('stickers').getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/** List the current user's stickers, newest first. */
export async function listMyStickers(limit = 200): Promise<Sticker[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return [];
  const uid = me.user.id;

  const { data, error } = await supabase.storage.from('stickers').list(uid, {
    limit,
    sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) throw error;

  return (data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => {
      const path = `${uid}/${f.name}`;
      return { path, name: f.name, url: supabase.storage.from('stickers').getPublicUrl(path).data.publicUrl };
    });
}

/** Delete one of the current user's stickers. */
export async function deleteSticker(path: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await supabase.storage.from('stickers').remove([path]);
  if (error) throw error;
}
