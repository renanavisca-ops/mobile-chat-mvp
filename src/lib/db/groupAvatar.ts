'use client';

import { browserSupabase } from '@/lib/supabase/client';

/** Upload a group photo to the public `group-avatars` bucket. Admin / perm_edit enforced by the RPC. */
export async function uploadGroupAvatar(chatId: string, file: File): Promise<string> {
  const supabase = browserSupabase();

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `groups/${chatId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('group-avatars').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
    // Unique timestamped path per upload → immutable, so cache for a year.
    cacheControl: '31536000',
  });
  if (error) throw error;

  const { data } = supabase.storage.from('group-avatars').getPublicUrl(path);

  // Set via RPC so group-edit permissions (admins / perm_edit) are enforced.
  const { error: updErr } = await (supabase as any).rpc('set_group_avatar', { p_chat_id: chatId, p_url: data.publicUrl });
  if (updErr) throw updErr;

  return data.publicUrl;
}
