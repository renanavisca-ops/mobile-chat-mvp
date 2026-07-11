'use client';

import { browserSupabase } from '@/lib/supabase/client';
import { ensureLocalDevice } from '@/lib/db/chats';

export type ForwardPayload = {
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  audioPath?: string;
};

export async function forwardMessageToChats(chatIds: string[], payload: ForwardPayload, senderUserId: string) {
  if (!chatIds.length) return;
  if (!senderUserId) throw new Error('Not authenticated');

  const supabase = browserSupabase();
  const deviceId = await ensureLocalDevice(senderUserId);

  const ciphertext = JSON.stringify({ v: 1, ...payload });

  const rows = chatIds.map((chatId) => ({
    chat_id: chatId,
    sender_device_id: deviceId,
    message_type: 'whisper' as const,
    ciphertext,
    content: payload.text || null,
    sender_type: 'agent',
    sender_id: senderUserId,
    nonce: crypto.randomUUID(),
    read: false,
  }));

  const { error } = await supabase.from('messages').insert(rows as any);
  if (error) throw error;
}
