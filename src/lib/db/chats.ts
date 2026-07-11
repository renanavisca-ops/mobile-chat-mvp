'use client';

import { browserSupabase } from '@/lib/supabase/client';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

type ProfileForChats = {
  role?: 'agent' | 'admin' | 'superadmin' | string | null;
  store_id?: string | null;
};

const CHAT_SELECT = 'id, kind, title, created_at, store_id, assigned_to, status';

function mergeChats(target: Map<string, any>, rows: any[] | null | undefined) {
  for (const row of rows ?? []) {
    if (row?.id) target.set(row.id, row);
  }
}

export async function listChats(userId: string, profileInput?: ProfileForChats | null): Promise<ChatSummary[]> {
  const supabase = browserSupabase();

  if (!userId) return [];

  const profile = profileInput ?? null;
  const chatsById = new Map<string, any>();

  // 1) Internal direct/group chats are membership-based.
  const { data: memberships, error: memberErr } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', userId);

  if (memberErr) throw memberErr;

  const memberChatIds = Array.from(
    new Set((memberships ?? []).map((row: any) => row.chat_id).filter(Boolean))
  );

  if (memberChatIds.length > 0) {
    const { data: memberChats, error: memberChatsErr } = await supabase
      .from('chats')
      .select(CHAT_SELECT)
      .in('id', memberChatIds);

    if (memberChatsErr) throw memberChatsErr;
    mergeChats(chatsById, memberChats as any[]);
  }

  // 2) Customer/support chats are assignment/store based.
  if (profile?.role === 'agent') {
    const { data, error } = await supabase
      .from('chats')
      .select(CHAT_SELECT)
      .eq('assigned_to', userId);

    if (error) throw error;
    mergeChats(chatsById, data as any[]);
  } else if (profile?.role === 'admin' && profile.store_id) {
    const { data, error } = await supabase
      .from('chats')
      .select(CHAT_SELECT)
      .eq('store_id', profile.store_id);

    if (error) throw error;
    mergeChats(chatsById, data as any[]);
  } else if (profile?.role === 'superadmin') {
    const { data, error } = await supabase
      .from('chats')
      .select(CHAT_SELECT);

    if (error) throw error;
    mergeChats(chatsById, data as any[]);
  }

  const chatList = Array.from(chatsById.values()).sort((a, b) => {
    const at = new Date(a.created_at ?? 0).getTime();
    const bt = new Date(b.created_at ?? 0).getTime();
    return bt - at;
  });

  if (chatList.length === 0) return [];

  const chatIds = chatList.map((c) => c.id);

  const { data: lastMsgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, chat_id, content, ciphertext, created_at')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: false })
    .limit(500);

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

export async function createDirectChatWith(userId: string, accessToken: string): Promise<string> {
  if (!accessToken) throw new Error('Session token not ready');

  const res = await fetch('/api/chats/direct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ other_user: userId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'Could not create direct chat');
  if (!data?.chatId) throw new Error('Direct chat API did not return chatId');

  return data.chatId as string;
}

export async function createGroupChat(title: string, memberIds: string[], accessToken: string): Promise<string> {
  if (!accessToken) throw new Error('Session token not ready');

  const res = await fetch('/api/chats/group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title, member_ids: memberIds }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'Could not create group chat');
  if (!data?.chatId) throw new Error('Group chat API did not return chatId');

  return data.chatId as string;
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

export async function sendMessage(chatId: string, payload: MessagePayload, senderUserId: string) {
  const supabase = browserSupabase();

  if (!senderUserId) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(senderUserId);

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
      sender_id: senderUserId,
      nonce,
      read: false,
    },
  ] as any);

  if (error) throw error;
}

export async function deleteMessage(messageId: string, chatId: string, senderUserId: string) {
  const supabase = browserSupabase();

  if (!senderUserId) throw new Error('Not authenticated');

  const { data: msg, error: getErr } = await supabase
    .from('messages')
    .select('ciphertext, sender_id')
    .eq('id', messageId)
    .eq('chat_id', chatId)
    .single();

  if (getErr) throw getErr;
  if (!msg) throw new Error('Message not found');
  if ((msg as any).sender_id && (msg as any).sender_id !== senderUserId) {
    throw new Error('You can only delete your own messages');
  }

  let currentPayload = {};
  try {
    currentPayload = JSON.parse((msg as any).ciphertext);
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
    .eq('id', messageId)
    .eq('chat_id', chatId);

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

async function validateCachedDevice(userId: string, deviceId: string): Promise<string | null> {
  const supabase = browserSupabase();

  const { data, error } = await supabase
    .from('devices')
    .select('id')
    .eq('id', deviceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as any).id as string;
}

export async function ensureLocalDevice(userId: string): Promise<string> {
  const supabase = browserSupabase();

  if (!userId) throw new Error('Not authenticated');

  const cacheKey = `active_device_id:${userId}`;
  const cached = window.localStorage.getItem(cacheKey);

  if (cached) {
    const valid = await validateCachedDevice(userId, cached);
    if (valid) return valid;
    window.localStorage.removeItem(cacheKey);
  }

  const legacyCached = window.localStorage.getItem('active_device_id');
  if (legacyCached) {
    const valid = await validateCachedDevice(userId, legacyCached);
    if (valid) {
      window.localStorage.setItem(cacheKey, valid);
      return valid;
    }
    window.localStorage.removeItem('active_device_id');
  }

  const { data: devices, error } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const deviceList = (devices ?? []) as any[];

  if (deviceList.length > 0) {
    window.localStorage.setItem(cacheKey, deviceList[0].id);
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

  window.localStorage.setItem(cacheKey, createdDevice.id);
  window.localStorage.setItem('active_device_id', createdDevice.id);
  return createdDevice.id as string;
}
