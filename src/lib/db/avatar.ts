'use client';

import { browserSupabase } from '@/lib/supabase/client';

/**
 * Upload a profile avatar to the public `avatars` bucket under the user's own
 * folder (avatars/<uid>/...), and return its public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = browserSupabase();

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
