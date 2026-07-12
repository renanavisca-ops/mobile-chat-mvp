'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ChatSummary, MessageRow } from '@/lib/db/types';

/**
 * List the chats the current user can see.
 * RLS already scopes `chats` to (a) chats where the user is a member and
 * (b) store chats visible to admins/agents, so we can select directly.
 * For direct chats we derive a display title from the other member's username.
 */
export async function listChats(): Promise<ChatSummary[]> {
  const supabase = browserSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: chats, error } = await supabase
    .from('chats')
    .select('id, kind, title, created_at, store_id, assigned_to, status')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const chatList = chats ?? [];
  if (chatList.length === 0) return [];

  const chatIds = chatList.map((c) => c.id);

  // Members (for direct-chat titles) + last messages, in parallel
  const [membersRes, msgsRes] = await Promise.all([
    supabase.from('chat_members').select('chat_id, user_id').in('chat_id', chatIds),
    supabase
      .from('messages')
      .select('id, chat_id, content, ciphertext, created_at')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  // Map chat -> other user ids
  const otherIdsByChat = new Map<string, string[]>();
  const allOtherIds = new Set<string>();
  for (const row of membersRes.data ?? []) {
    if (row.user_id === user.id) continue;
    const arr = otherIdsByChat.get(row.chat_id) ?? [];
    arr.push(row.user_id);
    otherIdsByChat.set(row.chat_id, arr);
    allOtherIds.add(row.user_id);
  }

  // Resolve usernames for those users
  const usernameById = new Map<string, string>();
  if (allOtherIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', Array.from(allOtherIds));
    for (const p of profs ?? []) usernameById.set(p.id, p.username ?? '');
  }

  // Latest message preview per chat
  const latestByChat = new Map<string, { created_at: string; content: string | null }>();
  for (const m of msgsRes.data ?? []) {
    if (latestByChat.has(m.chat_id)) continue;
    let preview = m.content || '';
    if (!preview && m.ciphertext) {
      try {
        const parsed = JSON.parse(m.ciphertext);
        if (parsed.text) preview = parsed.text;
        else if (parsed.imagePath || parsed.imagePaths?.length > 0) preview = '📷 Imagen';
        else if (parsed.videoPath) preview = '📹 Video';
        else if (parsed.audioPath) preview = '🎵 Audio';
        else if (parsed.is_deleted) preview = '🚫 Mensaje eliminado';
      } catch {}
    }
    latestByChat.set(m.chat_id, { created_at: m.created_at, content: preview || null });
  }

  return chatList.map((c) => {
    let title = c.title;
    if (c.kind === 'direct') {
      const others = (otherIdsByChat.get(c.id) ?? [])
        .map((id) => usernameById.get(id))
        .filter((n): n is string => !!n);
      if (others.length) title = others.join(', ');
    }
    const otherIds = otherIdsByChat.get(c.id) ?? [];
    return {
      id: c.id,
      kind: c.kind as 'direct' | 'group',
      title,
      created_at: c.created_at,
      store_id: c.store_id,
      assigned_to: c.assigned_to,
      status: c.status as ChatSummary['status'],
      last_message_at: latestByChat.get(c.id)?.created_at ?? null,
      last_ciphertext: latestByChat.get(c.id)?.content ?? null,
      other_user_id: c.kind === 'direct' ? otherIds[0] ?? null : null,
      member_ids: otherIds,
    };
  });
}

export async function createDirectChatWith(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('create_direct_chat', {
    other_user: userId,
  });

  if (error) throw error;

  return data as string;
}

export async function createGroupChat(title: string, memberIds: string[]): Promise<string> {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('create_group_chat', {
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

  return ((data ?? []) as unknown as MessageRow[]).reverse();
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
    sender_id: me.user.id,
    message_type: 'whisper',
    ciphertext,
    content: payload.text || null,
    sender_type: 'agent',
    nonce,
  });

  if (error) throw error;
}

export async function deleteMessage(messageId: string, chatId: string) {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data: msg } = await supabase
    .from('messages')
    .select('ciphertext')
    .eq('id', messageId)
    .single();

  if (!msg) throw new Error('Message not found');

  let currentPayload: Record<string, unknown> = {};
  try {
    currentPayload = JSON.parse(msg.ciphertext);
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
    .update({ ciphertext: deletedPayload, content: null })
    .eq('id', messageId);

  if (error) throw error;
}

/**
 * Mark the OTHER participants' unread messages as read.
 * Never marks your own messages (that's what makes ✓ vs ✓✓ meaningful).
 */
export async function markMessagesAsRead(chatId: string) {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;

  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('chat_id', chatId)
    .eq('read', false)
    .neq('sender_id', me.user.id);

  if (error) console.error(error);
}

async function ensureLocalDevice(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const cached = window.localStorage.getItem('active_device_id');

  // NEVER trust the cached id blindly: messages.sender_device_id has a hard
  // foreign key to devices(id), so a stale cached id (device deleted / from a
  // previous project) makes every message insert fail. Always reconcile the
  // cache against the devices that actually exist for this user.
  const { data: devices, error } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId);

  if (error) throw error;

  const ids = (devices ?? []).map((d) => d.id);

  if (cached && ids.includes(cached)) return cached;

  if (ids.length > 0) {
    window.localStorage.setItem('active_device_id', ids[0]);
    return ids[0];
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
      signed_prekey_signature: 'mvp',
    })
    .select('id')
    .single();

  if (cErr) throw cErr;

  window.localStorage.setItem('active_device_id', created.id);
  return created.id;
}
