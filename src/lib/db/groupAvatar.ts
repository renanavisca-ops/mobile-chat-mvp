'use client';

import { browserSupabase } from '@/lib/supabase/client';

/** Upload a group photo to the public `group-avatars` bucket. Creator-only (RLS). */
export async function uploadGroupAvatar(chatId: string, file: File): Promise<string> {
  const supabase = browserSupabase();

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `groups/${chatId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('group-avatars').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;

  const { data } = supabase.storage.from('group-avatars').getPublicUrl(path);

  const { error: updErr } = await supabase.from('chats').update({ avatar_url: data.publicUrl }).eq('id', chatId);
  if (updErr) throw updErr;

  return data.publicUrl;
}
