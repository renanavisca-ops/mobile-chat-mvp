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

export async function forwardMessageToChats(chatIds: string[], payload: ForwardPayload, senderUserId?: string) {
  if (!chatIds.length) return;

  const supabase = browserSupabase();

  let userId = senderUserId ?? '';

  if (!userId) {
    const { data: me } = await supabase.auth.getUser();
    userId = me.user?.id ?? '';
  }

  if (!userId) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(userId);

  // En MVP reenviamos el payload tal cual (no re-subimos media)
  const ciphertext = JSON.stringify({ v: 1, ...payload });

  const rows = chatIds.map((chatId) => ({
    chat_id: chatId,
    sender_device_id: deviceId,
    message_type: 'whisper' as const,
    ciphertext,
    content: payload.text || null,
    sender_type: 'agent',
    sender_id: userId,
    nonce: crypto.randomUUID(),
  }));

  const { error } = await supabase.from('messages').insert(rows as any);
  if (error) throw error;
}
