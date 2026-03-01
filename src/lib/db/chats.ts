'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

export async function listChats(): Promise<ChatSummary[]> {
  const supabase = browserSupabase();

  const { data: chats, error } = await supabase
    .from('chats')
    .select('id, kind, title, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const chatList = (chats ?? []) as Array<Pick<ChatSummary, 'id' | 'kind' | 'title' | 'created_at'>>;
  if (chatList.length === 0) return [];

  const chatIds = chatList.map((c) => c.id);

  const { data: lastMsgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, chat_id, ciphertext, created_at')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (msgErr) throw msgErr;

  const latestByChat = new Map<string, { created_at: string; ciphertext: string }>();
  for (const m of lastMsgs ?? []) {
    if (!latestByChat.has(m.chat_id)) latestByChat.set(m.chat_id, { created_at: m.created_at, ciphertext: m.ciphertext });
  }

  return chatList.map((c) => ({
    ...c,
    last_message_at: latestByChat.get(c.id)?.created_at ?? null,
    last_ciphertext: latestByChat.get(c.id)?.ciphertext ?? null
  }));
}

export async function createDirectChatWith(userId: string): Promise<string> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('create_direct_chat', { other_user: userId });
  if (error) throw error;

  return data as string;
}

export async function createGroupChat(title: string, memberIds: string[]): Promise<string> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('create_group_chat', {
    title,
    member_ids: memberIds
  });

  if (error) throw error;

  return data as string;
}

export async function listMessages(chatId: string, limit = 200): Promise<MessageRow[]> {
  const supabase = browserSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select('id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export type MessagePayload = {
  text?: string;
  imagePath?: string;
};

export async function sendMessage(chatId: string, payload: MessagePayload) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(me.user.id);

  const ciphertext = JSON.stringify({ v: 1, ...payload });
  const nonce = crypto.randomUUID();

  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    sender_device_id: deviceId,
    message_type: 'whisper',
    ciphertext,
    nonce
  });

  if (error) throw error;
}

async function ensureLocalDevice(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const cached = window.localStorage.getItem('active_device_id');
  if (cached) return cached;

  const { data: devices, error } = await supabase.from('devices').select('id').limit(1);
  if (error) throw error;

  if (devices && devices.length > 0) {
    window.localStorage.setItem('active_device_id', devices[0].id);
    return devices[0].id as string;
  }

  const label = `Web-${new Date().toISOString().slice(0, 10)}`;

  const { data: created, error: cErr } = await supabase
    .from('devices')
    .insert({
      user_id: userId,
      device_label: label,
      registration_id: 1,
      identity_public_key: 'mvp',
      signed_prekey_id: 1,
      signed_prekey_public: 'mvp',
      signed_prekey_signature: 'mvp'
    })
    .select('id')
    .single();

  if (cErr) throw cErr;

  window.localStorage.setItem('active_device_id', created.id);
  return created.id as string;
}
