'use client';

import { browserSupabase } from '@/lib/supabase/client';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

type ProfileForChats = {
  role?: 'agent' | 'admin' | 'superadmin' | string | null;
  store_id?: string | null;
};

export async function listChats(userId?: string, profileInput?: ProfileForChats | null): Promise<ChatSummary[]> {
  const supabase = browserSupabase();

  let currentUserId = userId ?? '';

  if (!currentUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    currentUserId = user?.id ?? '';
  }

  if (!currentUserId) return [];

  let p: any = profileInput ?? null;

  if (!p) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('store_id, role')
      .eq('id', currentUserId)
      .single();

    if (profileErr || !profile) return [];
    p = profile as any;
  }

  let query = supabase
    .from('chats')
    .select('id, kind, title, created_at, store_id, assigned_to, status');

  if (p.role === 'agent') {
    query = query.eq('assigned_to', currentUserId);
  } else if (p.role === 'admin') {
    query = query.eq('store_id', p.store_id);
  } else if (p.role === 'superadmin') {
    // sin filtro
  }

  const { data: chats, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) throw error;

  const chatList = (chats ?? []) as any[];

  if (chatList.length === 0) return [];

  const chatIds = chatList.map((c) => c.id);

  const { data: lastMsgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, chat_id, content, ciphertext, created_at')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (msgErr) throw msgErr;

  const latestByChat = new Map<string, { created_at: string; content: string | null }>();

  for (const rawMsg of lastMsgs ?? []) {
    const m = rawMsg as any;

    if (!latestByChat.has(m.chat_id)) {
      let preview = m.content || '';

      if (!preview && m.ciphertext) {
        try {
          const parsed = JSON.parse(m.ciphertext);

          if (parsed.text) preview = parsed.text;
          else if (parsed.imagePath || (parsed.imagePaths?.length > 0)) preview = '📷 Imagen';
          else if (parsed.videoPath) preview = '📹 Video';
          else if (parsed.audioPath) preview = '🎵 Audio';
          else if (parsed.is_deleted) preview = '🚫 Mensaje eliminado';
        } catch {}
      }

      latestByChat.set(m.chat_id, {
        created_at: m.created_at,
        content: preview || null,
      });
    }
  }

  return chatList.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    created_at: c.created_at,
    store_id: c.store_id,
    assigned_to: c.assigned_to,
    status: c.status,
    last_message_at: latestByChat.get(c.id)?.created_at ?? null,
    last_ciphertext: latestByChat.get(c.id)?.content ?? null,
  })) as ChatSummary[];
}

export async function createDirectChatWith(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const { data, error } = await (supabase as any).rpc('create_direct_chat', {
    other_user: userId,
  });

  if (error) throw error;

  return data as string;
}

export async function createGroupChat(title: string, memberIds: string[]): Promise<string> {
  const supabase = browserSupabase();

  const { data, error } = await (supabase as any).rpc('create_group_chat', {
    title,
    member_ids: memberIds,
  });

  if (error) throw error;

  return data as string;
}

export async function listMessages(
  chatId: string,
  limit = 50,
  offset = 0
): Promise<MessageRow[]> {
  const supabase = browserSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status'
    )
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return ((data ?? []) as any[]).reverse() as MessageRow[];
}

export type MessagePayload = {
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  audioPath?: string;
  reply_to?: string;
  is_deleted?: boolean;
};

export async function sendMessage(chatId: string, payload: MessagePayload, senderUserId?: string) {
  const supabase = browserSupabase();

  let userId = senderUserId ?? '';

  if (!userId) {
    const { data: me } = await supabase.auth.getUser();
    userId = me.user?.id ?? '';
  }

  if (!userId) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(userId);

  const ciphertext = JSON.stringify({ v: 1, ...payload });
  const nonce = crypto.randomUUID();

  const { error } = await supabase.from('messages').insert([
    {
      chat_id: chatId,
      sender_device_id: deviceId,
      message_type: 'whisper',
      ciphertext,
      content: payload.text || null,
      sender_type: 'agent',
      sender_id: userId,
      nonce,
    },
  ] as any);

  if (error) throw error;
}

export async function deleteMessage(messageId: string, chatId: string, senderUserId?: string) {
  const supabase = browserSupabase();

  let userId = senderUserId ?? '';

  if (!userId) {
    const { data: me } = await supabase.auth.getUser();
    userId = me.user?.id ?? '';
  }

  if (!userId) throw new Error('Not authenticated');

  const { data: msg } = await supabase
    .from('messages')
    .select('ciphertext')
    .eq('id', messageId)
    .single();

  if (!msg) throw new Error('Message not found');

  const m = msg as any;

  let currentPayload = {};
  try {
    currentPayload = JSON.parse(m.ciphertext);
  } catch {}

  const deletedPayload = JSON.stringify({
    ...currentPayload,
    text: '',
    imagePaths: [],
    imagePath: null,
    videoPath: null,
    audioPath: null,
    is_deleted: true,
  });

  const { error } = await supabase
    .from('messages')
    .update({
      ciphertext: deletedPayload,
      content: null,
    } as any)
    .eq('id', messageId);

  if (error) throw error;
}

export async function markMessagesAsRead(chatId: string) {
  const supabase = browserSupabase();

  const { error } = await supabase
    .from('messages')
    .update({ read: true } as any)
    .eq('chat_id', chatId)
    .eq('read', false);

  if (error) console.error(error);
}

export async function ensureLocalDevice(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const cached = window.localStorage.getItem('active_device_id');
  if (cached) return cached;

  const { data: devices, error } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const deviceList = (devices ?? []) as any[];

  if (deviceList.length > 0) {
    window.localStorage.setItem('active_device_id', deviceList[0].id);
    return deviceList[0].id as string;
  }

  const bundle = await createLocalDeviceBundle();
  const label = `Web-${new Date().toISOString().slice(0, 10)}`;

  const { data: created, error: cErr } = await supabase
    .from('devices')
    .insert([
      {
        user_id: userId,
        device_label: label,
        registration_id: bundle.registrationId,
        identity_public_key: bundle.identityKey,
        signed_prekey_id: bundle.signedPreKeyId,
        signed_prekey_public: bundle.signedPreKeyPublic,
        signed_prekey_signature: bundle.signedPreKeySignature,
      },
    ] as any)
    .select('id')
    .single();

  if (cErr) throw cErr;

  const createdDevice = created as any;

  window.localStorage.setItem('active_device_id', createdDevice.id);
  return createdDevice.id as string;
}
