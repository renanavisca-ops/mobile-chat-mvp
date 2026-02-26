'use client';

import { browserSupabase } from '@/lib/supabase/client';

/**
 * IMPORTANT:
 * Path convention enforced by your Storage policies:
 *   chats/<chatId>/<file>
 */
export async function uploadChatImage(chatId: string, file: File): Promise<{ path: string }> {
  const supabase = browserSupabase();

  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `chats/${chatId}/${fileName}`;

  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream'
  });

  if (error) throw error;

  return { path };
}

export async function createSignedChatMediaUrl(path: string, expiresSeconds = 60 * 10): Promise<string> {
  const supabase = browserSupabase();

  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, expiresSeconds);
  if (error) throw error;

  return data.signedUrl;
}
