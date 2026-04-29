'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

export async function listChats(): Promise<ChatSummary[]> {
  const supabase = browserSupabase();

  // 1. Obtener usuario y perfil
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) return [];

  // 2. Construir query base
  let query = supabase
    .from('chats')
    .select('id, kind, title, created_at, store_id, assigned_to, status');


  // 3. Aplicar filtros según rol
  if (profile.role === 'agent') {
    query = query.eq('assigned_to', user.id);
  } else if (profile.role === 'admin') {
    query = query.eq('store_id', profile.store_id);
  } else if (profile.role === 'superadmin') {
    // No filtramos nada
  }

  const { data: chats, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  const chatList = (chats ?? []) as Array<Pick<ChatSummary, 'id' | 'kind' | 'title' | 'created_at'>>;
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
  for (const m of lastMsgs ?? []) {
    if (!latestByChat.has(m.chat_id)) {
      let preview = m.content || '';
      if (!preview && m.ciphertext) {
         try {
           const parsed = JSON.parse(m.ciphertext);
           if (parsed.text) preview = parsed.text;
           else if (parsed.imagePath || (parsed.imagePaths && parsed.imagePaths.length > 0)) preview = '📷 Imagen';
           else if (parsed.videoPath) preview = '📹 Video';
           else if (parsed.audioPath) preview = '🎵 Audio';
           else if (parsed.is_deleted) preview = '🚫 Mensaje eliminado';
         } catch {}
      }
      latestByChat.set(m.chat_id, { 
        created_at: m.created_at, 
        content: preview || null
      });
    }
  }

  return chatList.map((c) => ({
    ...c,
    last_message_at: latestByChat.get(c.id)?.created_at ?? null,
    last_ciphertext: latestByChat.get(c.id)?.content ?? null
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

export async function listMessages(chatId: string, limit = 50, offset = 0): Promise<MessageRow[]> {
  const supabase = browserSupabase();

  const { data, error } = await supabase
    .from('messages')
    .select('id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []).reverse() as MessageRow[];
}

/**
 * Payload MVP:
 * - text
 * - single imagePath (legacy)
 * - multi imagePaths (new)
 * - videoPath
 * - audioPath (voice notes)
 * - reply_to (message id)
 * - is_deleted
 */
export type MessagePayload = {
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  audioPath?: string;
  reply_to?: string;
  is_deleted?: boolean;
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
    content: payload.text || null,
    sender_type: 'agent',
    nonce
  });

  if (error) throw error;
}

export async function deleteMessage(messageId: string, chatId: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  // Recuperar el mensaje original
  const { data: msg } = await supabase.from('messages').select('ciphertext').eq('id', messageId).single();
  if (!msg) throw new Error('Message not found');

  let currentPayload = {};
  try {
    currentPayload = JSON.parse(msg.ciphertext);
  } catch {}

  // Hacer soft delete: conservar el tipo y ID, pero cambiar el contenido
  const deletedPayload = JSON.stringify({ ...currentPayload, text: '', imagePaths: [], imagePath: null, videoPath: null, audioPath: null, is_deleted: true });

  const { error } = await supabase.from('messages').update({ ciphertext: deletedPayload, content: null }).eq('id', messageId);
  if (error) throw error;
}

export async function markMessagesAsRead(chatId: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;

  // Marcamos como leídos los mensajes que NO son nuestros y pertenecen a este chat
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('chat_id', chatId)
    .eq('read', false);
    // .neq('sender_device_id', ...) // Opcional: solo marcar los del otro

  if (error) console.error('Error marking messages as read:', error);
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
