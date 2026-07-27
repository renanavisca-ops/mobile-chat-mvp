'use client';

import { browserSupabase } from '@/lib/supabase/client';

/**
 * Upload a profile avatar to the public `avatars` bucket under the user's own
 * folder (avatars/<uid>/...), and return its public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = browserSupabase();

  // Derive the id from the live session, not just the passed argument. The
  // avatars bucket's RLS policy requires the first path segment to equal
  // auth.uid(); pulling the id straight from the current session guarantees
  // that match even if the caller's cached user is stale, and lets us give a
  // clear "sign in again" message instead of a raw RLS error.
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? userId;
  if (!uid) throw new Error('You need to be signed in to change your photo.');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${uid}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) {
    // The common failure here is a lost/expired session (upload runs as anon →
    // RLS blocks it). Translate that into something a user can act on.
    if (/row-level security|violates|unauthorized|permission|jwt/i.test(error.message)) {
      throw new Error('Could not save your photo. Please sign out and sign back in, then try again.');
    }
    throw error;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
