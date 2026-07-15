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
    .select('id, kind, title, created_at, store_id, assigned_to, status, pinned_message_id, avatar_url, description, disappearing_seconds, created_by, is_public')
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

  // Map chat -> other user ids, and track which chats *I* belong to.
  const otherIdsByChat = new Map<string, string[]>();
  const allOtherIds = new Set<string>();
  const myMemberChatIds = new Set<string>();
  for (const row of membersRes.data ?? []) {
    if (row.user_id === user.id) {
      myMemberChatIds.add(row.chat_id);
      continue;
    }
    const arr = otherIdsByChat.get(row.chat_id) ?? [];
    arr.push(row.user_id);
    otherIdsByChat.set(row.chat_id, arr);
    allOtherIds.add(row.user_id);
  }

  // Resolve display names + avatars for those users
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string | null>();
  if (allOtherIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(allOtherIds));
    for (const p of profs ?? []) {
      nameById.set(p.id, (p.display_name || p.username) ?? '');
      avatarById.set(p.id, p.avatar_url ?? null);
    }
  }

  // Latest message preview per chat. `kind` lets the UI render a translated
  // label for non-text previews instead of a hardcoded-language string here
  // (this module isn't a component and can't call the i18n hook).
  const latestByChat = new Map<
    string,
    { created_at: string; content: string | null; kind: 'text' | 'photo' | 'video' | 'audio' | 'gif' | 'poll' | 'file' | 'deleted' | null }
  >();
  for (const m of msgsRes.data ?? []) {
    if (latestByChat.has(m.chat_id)) continue;
    let content = m.content || '';
    let kind: 'text' | 'photo' | 'video' | 'audio' | 'gif' | 'poll' | 'file' | 'deleted' | null = content ? 'text' : null;
    if (!content && m.ciphertext) {
      try {
        const parsed = JSON.parse(m.ciphertext);
        if (parsed.text) {
          content = parsed.text;
          kind = 'text';
        } else if (parsed.imagePath || parsed.imagePaths?.length > 0) {
          kind = 'photo';
        } else if (parsed.videoPath) {
          kind = 'video';
        } else if (parsed.audioPath) {
          kind = 'audio';
        } else if (parsed.gifUrl) {
          kind = 'gif';
        } else if (parsed.filePath) {
          kind = 'file';
        } else if (parsed.poll) {
          kind = 'poll';
        } else if (parsed.is_deleted) {
          kind = 'deleted';
        }
      } catch {}
    }
    latestByChat.set(m.chat_id, { created_at: m.created_at, content: content || null, kind });
  }

  // Public channels are globally visible via RLS (for discovery); the main
  // list must only show chats I actually belong to (plus store chats I staff).
  const myChats = chatList.filter((c) => myMemberChatIds.has(c.id) || !!c.store_id);

  return myChats.map((c) => {
    let title = c.title;
    if (c.kind === 'direct') {
      const others = (otherIdsByChat.get(c.id) ?? [])
        .map((id) => nameById.get(id))
        .filter((n): n is string => !!n);
      if (others.length) title = others.join(', ');
    }
    const otherIds = otherIdsByChat.get(c.id) ?? [];
    return {
      id: c.id,
      kind: c.kind as ChatSummary['kind'],
      title,
      is_public: c.is_public,
      created_by: c.created_by,
      created_at: c.created_at,
      store_id: c.store_id,
      assigned_to: c.assigned_to,
      status: c.status as ChatSummary['status'],
      pinned_message_id: c.pinned_message_id,
      avatar_url: c.avatar_url,
      description: c.description,
      disappearing_seconds: c.disappearing_seconds,
      last_message_at: latestByChat.get(c.id)?.created_at ?? null,
      last_ciphertext: latestByChat.get(c.id)?.content ?? null,
      last_message_kind: latestByChat.get(c.id)?.kind ?? null,
      other_user_id: c.kind === 'direct' ? otherIds[0] ?? null : null,
      other_user_avatar: c.kind === 'direct' ? avatarById.get(otherIds[0]) ?? null : null,
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

/* ------------------------------ Channels ----------------------------- */

/** Create a public broadcast channel; returns its chat id. */
export async function createChannel(title: string, description?: string): Promise<string> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.rpc('create_channel', {
    p_title: title,
    p_description: description ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export type ChannelSummary = {
  id: string;
  title: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  joined: boolean;
};

/** List public channels for discovery, flagging which ones you've joined. */
export async function listPublicChannels(search?: string): Promise<ChannelSummary[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();

  let query = supabase
    .from('chats')
    .select('id, title, description, avatar_url, created_by')
    .eq('kind', 'channel')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(100);

  const q = (search ?? '').trim();
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query;
  if (error) throw error;

  const channels = data ?? [];
  let joinedIds = new Set<string>();
  if (me.user && channels.length > 0) {
    const { data: mems } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', me.user.id)
      .in('chat_id', channels.map((c) => c.id));
    joinedIds = new Set((mems ?? []).map((m) => m.chat_id));
  }

  return channels.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    avatar_url: c.avatar_url,
    created_by: c.created_by,
    joined: joinedIds.has(c.id),
  }));
}

/** Join a public channel (self-insert membership). */
export async function joinChannel(chatId: string): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const { error } = await supabase.from('chat_members').insert({ chat_id: chatId, user_id: me.user.id });
  if (error && !String(error.message).includes('duplicate')) throw error;
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
      'id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status, edited_at, expires_at'
    )
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const now = Date.now();
  const rows = (data ?? []) as unknown as MessageRow[];
  return rows.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now).reverse();
}

export type MessagePayload = {
  text?: string;
  imagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  videoTrimStart?: number;
  videoTrimEnd?: number;
  audioPath?: string;
  gifUrl?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  reply_to?: string;
  is_deleted?: boolean;
};

/** Fetch the chat's disappearing-messages timer (seconds), or null if off. */
async function getDisappearingSeconds(chatId: string): Promise<number | null> {
  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('chats')
    .select('disappearing_seconds')
    .eq('id', chatId)
    .maybeSingle();
  if (error) throw error;
  return data?.disappearing_seconds ?? null;
}

export async function sendMessage(chatId: string, payload: MessagePayload) {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(me.user.id);

  const ciphertext = JSON.stringify({ v: 1, ...payload });
  const nonce = crypto.randomUUID();

  const disappearingSeconds = await getDisappearingSeconds(chatId);
  const expiresAt = disappearingSeconds
    ? new Date(Date.now() + disappearingSeconds * 1000).toISOString()
    : null;

  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    sender_device_id: deviceId,
    sender_id: me.user.id,
    message_type: 'whisper',
    ciphertext,
    content: payload.text || null,
    sender_type: 'agent',
    nonce,
    expires_at: expiresAt,
  });

  if (error) throw error;
}

/** Set (or clear, with seconds=0) the disappearing-messages timer for a chat. */
export async function setDisappearingMessages(chatId: string, seconds: number) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('set_disappearing_messages', {
    p_chat_id: chatId,
    p_seconds: seconds,
  });
  if (error) throw error;
}

/**
 * Delete a message for everyone. Blanks out the payload and flags it deleted
 * so every participant sees the "message was deleted" placeholder. Only the
 * sender may do this (enforced by RLS on the messages table).
 */
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
 * "Delete for me": hide a message from the current user's view only. The
 * message stays intact for everyone else. Works on any message (yours or
 * someone else's) and syncs across the user's own devices via realtime.
 */
export async function hideMessageForMe(messageId: string, chatId: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('hidden_messages').upsert(
    { message_id: messageId, chat_id: chatId, user_id: me.user.id },
    { onConflict: 'user_id,message_id' }
  );
  if (error) throw error;
}

export async function listHiddenMessages(chatId: string): Promise<import('@/lib/db/types').HiddenMessage[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return [];

  const { data, error } = await supabase
    .from('hidden_messages')
    .select('user_id, message_id, chat_id, created_at')
    .eq('chat_id', chatId);
  if (error) throw error;
  return (data ?? []) as import('@/lib/db/types').HiddenMessage[];
}

/** Rename/describe a group chat. Only the group's creator may do this. */
export async function updateGroupInfo(chatId: string, title: string, description: string) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('update_group_info', {
    p_chat_id: chatId,
    p_title: title,
    p_description: description,
  });
  if (error) throw error;
}

/** Mute/unmute a chat for yourself (suppresses push notifications for it). */
export async function setChatMuted(chatId: string, muted: boolean) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('set_chat_muted', { p_chat_id: chatId, p_muted: muted });
  if (error) throw error;
}

export async function getChatMuted(chatId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return false;

  const { data, error } = await supabase
    .from('chat_members')
    .select('muted')
    .eq('chat_id', chatId)
    .eq('user_id', me.user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.muted ?? false;
}

/** Add members to a group. Only the group's creator may do this (enforced by RLS). */
export async function addGroupMembers(chatId: string, memberIds: string[]) {
  if (memberIds.length === 0) return;
  const supabase = browserSupabase();
  const { error } = await supabase
    .from('chat_members')
    .insert(memberIds.map((user_id) => ({ chat_id: chatId, user_id })));
  if (error) throw error;
}

/** Remove another member from a group. Only the group's creator may do this. */
export async function removeGroupMember(chatId: string, memberId: string) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('remove_group_member', { p_chat_id: chatId, p_member_id: memberId });
  if (error) throw error;
}

/** Leave a chat (removes yourself from chat_members). */
export async function leaveChat(chatId: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', me.user.id);
  if (error) throw error;
}

/**
 * Edit the text of a message you sent. Only updates the plain-text `content`
 * column and the ciphertext JSON's `text` field, preserving any attached
 * media on that message.
 */
export async function editMessage(messageId: string, newText: string) {
  const supabase = browserSupabase();

  const { data: msg, error: readErr } = await supabase
    .from('messages')
    .select('ciphertext')
    .eq('id', messageId)
    .single();
  if (readErr) throw readErr;

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(msg.ciphertext);
  } catch {}

  const ciphertext = JSON.stringify({ ...payload, text: newText });

  const { error } = await supabase
    .from('messages')
    .update({ content: newText, ciphertext, edited_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function pinMessage(chatId: string, messageId: string) {
  const supabase = browserSupabase();
  const { error } = await supabase.from('chats').update({ pinned_message_id: messageId }).eq('id', chatId);
  if (error) throw error;
}

export async function unpinMessage(chatId: string) {
  const supabase = browserSupabase();
  const { error } = await supabase.from('chats').update({ pinned_message_id: null }).eq('id', chatId);
  if (error) throw error;
}

/** Best-effort in-chat search over plain-text message content. */
export async function searchMessages(chatId: string, query: string, limit = 30): Promise<MessageRow[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status, edited_at')
    .eq('chat_id', chatId)
    .ilike('content', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as MessageRow[];
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

/* ---------------------------- Reactions ---------------------------- */

/**
 * Toggle a reaction from the current user on a message. If the user already
 * reacted with this exact emoji, the reaction is removed; if they reacted
 * with a different emoji, it's replaced (one reaction per user per message).
 */
export async function toggleReaction(messageId: string, chatId: string, emoji: string) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data: existing, error: readErr } = await supabase
    .from('message_reactions')
    .select('id, emoji')
    .eq('message_id', messageId)
    .eq('user_id', me.user.id)
    .maybeSingle();
  if (readErr) throw readErr;

  if (existing && existing.emoji === emoji) {
    const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('message_reactions').upsert(
    { message_id: messageId, chat_id: chatId, user_id: me.user.id, emoji },
    { onConflict: 'message_id,user_id' }
  );
  if (error) throw error;
}

export async function listReactions(chatId: string): Promise<import('@/lib/db/types').MessageReaction[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, chat_id, user_id, emoji, created_at')
    .eq('chat_id', chatId);
  if (error) throw error;
  return (data ?? []) as import('@/lib/db/types').MessageReaction[];
}

/* ------------------------------ Polls -------------------------------- */

export type PollPayload = { poll: { question: string; options: string[] } };

export async function createPoll(chatId: string, question: string, options: string[]) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(me.user.id);

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  if (!question.trim() || cleanOptions.length < 2) {
    throw new Error('A poll needs a question and at least 2 options');
  }

  const ciphertext = JSON.stringify({ v: 1, poll: { question: question.trim(), options: cleanOptions } });
  const nonce = crypto.randomUUID();

  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    sender_device_id: deviceId,
    sender_id: me.user.id,
    message_type: 'poll',
    ciphertext,
    sender_type: 'agent',
    nonce,
  });
  if (error) throw error;
}

export async function votePoll(messageId: string, chatId: string, optionIndex: number) {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('poll_votes').upsert(
    { message_id: messageId, chat_id: chatId, user_id: me.user.id, option_index: optionIndex },
    { onConflict: 'message_id,user_id' }
  );
  if (error) throw error;
}

export async function listPollVotes(chatId: string): Promise<import('@/lib/db/types').PollVote[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('poll_votes')
    .select('message_id, chat_id, user_id, option_index, created_at')
    .eq('chat_id', chatId);
  if (error) throw error;
  return (data ?? []) as import('@/lib/db/types').PollVote[];
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
