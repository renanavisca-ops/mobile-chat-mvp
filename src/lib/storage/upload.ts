'use client';

import { browserSupabase } from '@/lib/supabase/client';

export async function uploadChatImage(file: File): Promise<{ path: string; publicUrl: string }> {
  const supabase = browserSupabase();
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `images/${fileName}`;

  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream'
  });

  if (error) throw error;

  const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
