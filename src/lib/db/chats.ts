'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { ChatSummary, MessageRow } from '@/lib/db/types';
import {
  encryptForChat,
  decryptForChat,
  lockChat as ksLockChat,
  shareChatKeyWith,
} from '@/lib/crypto/keystore';
import { buildOutgoingEnvelope, EncryptionRequiredError } from '@/lib/db/outgoing-envelope';

export { EncryptionRequiredError };

/** Parse a message ciphertext column into a JSON object, or null. */
function parseEnvelope(ciphertext: string | null | undefined): Record<string, unknown> | null {
  if (!ciphertext) return null;
  try {
    return JSON.parse(ciphertext) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isEncryptedEnvelope(env: Record<string, unknown> | null): env is { e: number; iv: string; ct: string } {
  return !!env && env.e === 1 && typeof env.iv === 'string' && typeof env.ct === 'string';
}

/**
 * Decrypt an E2EE message row so the rest of the app can treat `ciphertext`
 * as the usual plaintext payload JSON. If we can't decrypt (no key on this
 * device yet), we substitute a marker payload the UI renders as locked.
 */
export async function decryptRow(chatId: string, row: MessageRow): Promise<MessageRow> {
  const env = parseEnvelope(row.ciphertext);
  if (isEncryptedEnvelope(env)) {
    const pt = await decryptForChat(chatId, { iv: env.iv, ct: env.ct });
    return { ...row, ciphertext: pt ?? JSON.stringify({ v: 1, encrypted: true }) };
  }
  return row;
}

async function decryptRows(chatId: string, rows: MessageRow[]): Promise<MessageRow[]> {
  if (!rows.some((r) => typeof r.ciphertext === 'string' && r.ciphertext.includes('"e":1'))) return rows;
  const out: MessageRow[] = [];
  for (const r of rows) out.push(await decryptRow(chatId, r));
  return out;
}

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
    .select('id, kind, title, created_at, store_id, assigned_to, status, pinned_message_id, avatar_url, description, disappearing_seconds, created_by, is_public, is_announcement')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const chatList = chats ?? [];
  if (chatList.length === 0) return [];

  const chatIds = chatList.map((c) => c.id);

  // Members (for direct-chat titles) + latest message PER chat, in parallel.
  // The latest-per-chat RPC returns exactly one row per chat, so a conversation
  // is never hidden just because its last message fell outside a global row cap.
  const [membersRes, msgsRes] = await Promise.all([
    (supabase as any).from('chat_members').select('chat_id, user_id, archived, favorite').in('chat_id', chatIds),
    (supabase as any).rpc('chat_latest_messages', { p_chat_ids: chatIds }),
  ]);
  // Defensive fallback if the RPC isn't available (e.g. an env without the
  // migration): fetch a capped preview so the list still renders.
  let latestRows: Array<{ chat_id: string; content: string | null; ciphertext: string | null; created_at: string }> =
    (msgsRes.data as any) ?? [];
  if (msgsRes.error) {
    const fb = await supabase
      .from('messages')
      .select('chat_id, content, ciphertext, created_at')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false })
      .limit(500);
    latestRows = fb.data ?? [];
  }
  // Graceful fallback if the archive migration hasn't been applied yet: refetch
  // without the `archived` column so the chat list still loads (all unarchived).
  let members: { chat_id: string; user_id: string; archived?: boolean; favorite?: boolean }[] = membersRes.data ?? [];
  if (membersRes.error) {
    const fb = await supabase.from('chat_members').select('chat_id, user_id').in('chat_id', chatIds);
    members = fb.data ?? [];
  }

  // Map chat -> other user ids, and track which chats *I* belong to.
  const otherIdsByChat = new Map<string, string[]>();
  const allOtherIds = new Set<string>();
  const myMemberChatIds = new Set<string>();
  const archivedByChat = new Map<string, boolean>();
  const favoriteByChat = new Map<string, boolean>();
  for (const row of members) {
    if (row.user_id === user.id) {
      myMemberChatIds.add(row.chat_id);
      archivedByChat.set(row.chat_id, !!row.archived);
      favoriteByChat.set(row.chat_id, !!row.favorite);
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
    { created_at: string; content: string | null; kind: 'text' | 'photo' | 'video' | 'audio' | 'gif' | 'sticker' | 'poll' | 'file' | 'call' | 'contact' | 'location' | 'event' | 'deleted' | null }
  >();
  for (const m of latestRows) {
    if (latestByChat.has(m.chat_id)) continue;
    let content = m.content || '';
    let kind: 'text' | 'photo' | 'video' | 'audio' | 'gif' | 'sticker' | 'poll' | 'file' | 'call' | 'contact' | 'location' | 'event' | 'deleted' | null = content ? 'text' : null;
    if (!content && m.ciphertext) {
      try {
        const parsed = JSON.parse(m.ciphertext);
        if (parsed.e === 1) {
          content = '🔒';
          kind = 'text';
        } else if (parsed.text) {
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
        } else if (parsed.stickerUrl) {
          kind = 'sticker';
        } else if (parsed.filePath) {
          kind = 'file';
        } else if (parsed.poll) {
          kind = 'poll';
        } else if (parsed.call) {
          kind = 'call';
        } else if (parsed.contact) {
          kind = 'contact';
        } else if (parsed.location) {
          kind = 'location';
        } else if (parsed.event) {
          kind = 'event';
        } else if (parsed.is_deleted) {
          kind = 'deleted';
        }
      } catch {}
    }
    latestByChat.set(m.chat_id, { created_at: m.created_at, content: content || null, kind });
  }

  // Per-chat unread count: messages from other people that I haven't read yet.
  // Computed via RPC so GROUPS use MY per-member read (message_reads) instead of
  // the shared `read` flag — in a group that flag only flips once everyone has
  // read, so using it here would keep a group I've already read marked unread.
  // 1:1 chats still use the shared flag.
  const unreadByChat = new Map<string, number>();
  {
    const { data: unreadRows, error: unreadErr } = await (supabase as any).rpc('my_unread_counts', {
      p_chat_ids: chatIds,
    });
    if (unreadErr) console.error(unreadErr);
    for (const r of (unreadRows ?? []) as { chat_id: string; cnt: number }[]) {
      unreadByChat.set(r.chat_id, r.cnt);
    }
  }

  // Public channels are globally visible via RLS (for discovery); the main
  // list must only show chats I actually belong to (plus store chats I staff).
  const myChats = chatList.filter((c) => myMemberChatIds.has(c.id) || !!c.store_id);

  const summaries = myChats.map((c) => {
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
      archived: archivedByChat.get(c.id) ?? false,
      favorite: favoriteByChat.get(c.id) ?? false,
      unread_count: unreadByChat.get(c.id) ?? 0,
      is_announcement: !!c.is_announcement,
      // A "Notas personales" chat is a group I created with no other members.
      is_self: c.kind === 'group' && otherIds.length === 0 && c.created_by === user.id,
    };
  });

  // Hide direct chats that have no messages yet: a one-to-one conversation only
  // appears once someone has actually sent something. The person who starts the
  // chat is taken straight into the conversation view, so nothing is lost — the
  // chat surfaces in both people's lists the moment the first message lands.
  // (Groups and channels always show, since you were deliberately added/joined.)
  const visibleSummaries = summaries.filter(
    (s) => s.kind !== 'direct' || s.last_message_at !== null
  );

  // Most recently active chats first (fall back to chat creation time for
  // chats with no messages yet).
  visibleSummaries.sort((a, b) => {
    const ta = new Date(a.last_message_at ?? a.created_at).getTime();
    const tb = new Date(b.last_message_at ?? b.created_at).getTime();
    return tb - ta;
  });

  return visibleSummaries;
}

export async function createDirectChatWith(userId: string): Promise<string> {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('create_direct_chat', {
    other_user: userId,
  });

  if (error) throw error;

  const chatId = data as string;

  // Phase 2: new direct chats REQUIRE end-to-end encryption. Mark them so the
  // send path fails closed (never stores plaintext) until the chat can be
  // locked. Existing/legacy chats are unaffected (enc_required stays false).
  const { error: reqErr } = await supabase.from('chats').update({ enc_required: true }).eq('id', chatId);
  if (reqErr) console.error('Could not mark chat as encryption-required:', reqErr.message);

  // Try to lock immediately. This only succeeds when BOTH people have an
  // encryption identity; if the other user hasn't enrolled yet the chat stays
  // enc_required-but-unlocked, and sending is blocked (fail-closed) until they
  // do. lockChat is idempotent, so a locked chat is never re-keyed.
  try {
    await ksLockChat(chatId, [userId]);
  } catch {
    // best effort — never block opening the chat on encryption setup
  }

  return chatId;
}

/**
 * "Notas personales": a chat with only yourself. Reuses create_group_chat
 * (which folds the creator in and dedupes, so passing [me] yields a solo chat),
 * locks it end-to-end to your own key, and remembers its id on-device so tapping
 * the entry again reopens the same chat instead of making duplicates.
 */
export async function getOrCreateSelfChat(title: string): Promise<string> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const uid = me.user.id;
  const key = `toky.selfChat.${uid}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  // Idempotent: reuse an existing self-chat (a group I created with no OTHER
  // members) instead of always making a new one. Without this, a cleared
  // localStorage / new device / the auto-create below would spawn duplicates.
  try {
    const { data: created } = await supabase
      .from('chats')
      .select('id')
      .eq('kind', 'group')
      .eq('created_by', uid);
    const ids = (created ?? []).map((c) => c.id as string);
    if (ids.length) {
      const { data: mems } = await supabase
        .from('chat_members')
        .select('chat_id, user_id')
        .in('chat_id', ids);
      const hasOther = new Set<string>();
      const seen = new Set<string>();
      for (const m of mems ?? []) {
        seen.add(m.chat_id as string);
        if ((m.user_id as string) !== uid) hasOther.add(m.chat_id as string);
      }
      const existing = ids.find((id) => seen.has(id) && !hasOther.has(id));
      if (existing) {
        try { localStorage.setItem(key, existing); } catch { /* ignore */ }
        return existing;
      }
    }
  } catch {
    /* fall through to create */
  }
  const chatId = await createGroupChat(title, [uid]);
  // Encrypt notes to yourself (best effort; never block opening the chat).
  try {
    await ksLockChat(chatId, [uid]);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, chatId);
  } catch {
    /* ignore */
  }
  return chatId;
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

/** Fixed set of channel categories for the discovery directory. */
export const CHANNEL_CATEGORIES = [
  'news', 'tech', 'business', 'education', 'entertainment', 'sports', 'community', 'other',
] as const;
export type ChannelCategory = (typeof CHANNEL_CATEGORIES)[number];

/** Create a public broadcast channel; returns its chat id. */
export async function createChannel(title: string, description?: string, category?: string): Promise<string> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any).rpc('create_channel', {
    p_title: title,
    p_description: description ?? undefined,
    p_category: category ?? undefined,
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
  category: string | null;
  joined: boolean;
};

/** List public channels for discovery, flagging which ones you've joined. */
export async function listPublicChannels(search?: string, category?: string): Promise<ChannelSummary[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();

  let query = (supabase as any)
    .from('chats')
    .select('id, title, description, avatar_url, created_by, category')
    .eq('kind', 'channel')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(100);

  const q = (search ?? '').trim();
  if (q) query = query.ilike('title', `%${q}%`);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;

  const channels = (data ?? []) as any[];
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
    category: c.category ?? null,
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

/** When the current user "cleared" this chat, only messages after this instant
 *  are shown to them. Null when they never cleared it. */
export async function myChatClearedAt(chatId: string): Promise<string | null> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return null;
  const { data } = await supabase
    .from('chat_members')
    .select('cleared_at')
    .eq('chat_id', chatId)
    .eq('user_id', me.user.id)
    .maybeSingle();
  return data?.cleared_at ?? null;
}

/** "Vaciar chat": hide the whole conversation for me from here on (server-side,
 *  permanent, per-member). Other members are unaffected. */
export async function clearChatForMe(chatId: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('clear_chat', { p_chat_id: chatId });
  if (error) throw error;
}

export async function listMessages(
  chatId: string,
  limit = 50,
  offset = 0
): Promise<MessageRow[]> {
  const supabase = browserSupabase();

  const clearedAt = await myChatClearedAt(chatId);
  let query = supabase
    .from('messages')
    .select(
      'id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status, edited_at, expires_at'
    )
    .eq('chat_id', chatId);
  if (clearedAt) query = query.gt('created_at', clearedAt);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const now = Date.now();
  const rows = (data ?? []) as unknown as MessageRow[];
  const visible = rows.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now).reverse();
  return decryptRows(chatId, visible);
}

/**
 * Fetch only messages created AFTER `sinceIso` (ascending). Used to "catch up"
 * a cached conversation without re-downloading the whole history — the caller
 * merges these onto its cached rows.
 */
export async function listMessagesSince(chatId: string, sinceIso: string): Promise<MessageRow[]> {
  const supabase = browserSupabase();
  const clearedAt = await myChatClearedAt(chatId);
  // Catch up only after both the cache high-water mark AND any "cleared" instant.
  const since = clearedAt && clearedAt > sinceIso ? clearedAt : sinceIso;
  const { data, error } = await supabase
    .from('messages')
    .select(
      'id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status, edited_at, expires_at'
    )
    .eq('chat_id', chatId)
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  const now = Date.now();
  const rows = (data ?? []) as unknown as MessageRow[];
  const visible = rows.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
  return decryptRows(chatId, visible);
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
  /** Public URL of a sticker (transparent PNG), rendered without a bubble. */
  stickerUrl?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  reply_to?: string;
  is_deleted?: boolean;
  /** User ids mentioned in `text` (groups). */
  mentions?: string[];
  /** A shared contact card. */
  contact?: { userId: string; name: string; username: string | null; avatarUrl: string | null };
  /** A shared one-time location. */
  location?: { lat: number; lng: number };
};

export async function sendMessage(chatId: string, payload: MessagePayload, clientId?: string) {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');

  const deviceId = await ensureLocalDevice(me.user.id);

  const { data: chatRow } = await supabase
    .from('chats')
    .select('disappearing_seconds, encrypted, enc_required')
    .eq('id', chatId)
    .maybeSingle();

  const plaintext = JSON.stringify({ v: 1, ...payload });

  // Opportunistic E2EE: encrypt whenever a chat key can be established on THIS
  // device; otherwise send normally (still protected in transit by TLS). We
  // never block the user from sending — a message auto-upgrades to end-to-end
  // encryption as soon as the chat can be locked (both parties enrolled and a
  // key present on this device).
  let canEncrypt = !!chatRow?.encrypted;
  if (!canEncrypt && chatRow?.enc_required) {
    const res = await enableChatEncryption(chatId).catch(() => ({ ok: false, missing: [] as string[] }));
    canEncrypt = res.ok;
  }

  const { ciphertext, content } = await buildOutgoingEnvelope({
    mustEncrypt: canEncrypt,
    opportunistic: true,
    plaintext,
    text: payload.text || null,
    seal: (pt) => encryptForChat(chatId, pt),
  });

  const nonce = crypto.randomUUID();

  const disappearingSeconds = chatRow?.disappearing_seconds ?? null;
  const expiresAt = disappearingSeconds
    ? new Date(Date.now() + disappearingSeconds * 1000).toISOString()
    : null;

  const row = {
    chat_id: chatId,
    sender_device_id: deviceId,
    sender_id: me.user.id,
    message_type: 'whisper',
    ciphertext,
    content,
    sender_type: 'agent',
    nonce,
    expires_at: expiresAt,
    client_id: clientId ?? null,
  };

  // With a client_id, upsert ignoring duplicates so a retry of a message that
  // already landed is a no-op (idempotent offline-queue retries).
  // Cast: client_id isn't in the generated types yet.
  const { error } = clientId
    ? await (supabase as any).from('messages').upsert(row, { onConflict: 'sender_id,client_id', ignoreDuplicates: true })
    : await (supabase as any).from('messages').insert(row);

  if (error) throw error;
}

export type CallEvent = {
  video: boolean;
  outcome: 'answered' | 'no_answer' | 'declined' | 'cancelled';
  /** Talk time in seconds, for an answered call. */
  duration?: number;
  /** True for a group call (changes the label shown in the thread). */
  isGroup?: boolean;
};

/**
 * Record a call in the chat thread (like WhatsApp): both sides see that a call
 * happened, how long it lasted, or that it went unanswered. The caller writes
 * this when the call ends.
 *
 * message_type 'system' makes the new-message push trigger skip it (the call
 * already alerted the callee, so a "new message" push would be noise), while
 * sender_type stays 'agent' so it renders as a normal aligned bubble (not a
 * centered system line). The payload lives in ciphertext as { v:1, call }.
 */
export async function logCallEvent(chatId: string, ev: CallEvent): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;
  const deviceId = await ensureLocalDevice(me.user.id);
  const nonce = crypto.randomUUID();
  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    sender_device_id: deviceId,
    sender_id: me.user.id,
    message_type: 'system',
    sender_type: 'agent',
    ciphertext: JSON.stringify({ v: 1, call: ev }),
    content: null,
    nonce,
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

  const currentEnv = parseEnvelope(msg.ciphertext);

  // For an encrypted message we must NOT keep the old ciphertext around (its
  // sealed content would still decrypt). Replace it with a plaintext tombstone.
  const deletedPayload = isEncryptedEnvelope(currentEnv)
    ? JSON.stringify({ v: 1, is_deleted: true })
    : JSON.stringify({
        ...(currentEnv ?? {}),
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

/**
 * Mute for a duration. `until` = when the mute expires (null = forever);
 * pass muted=false to unmute. Uses the set_chat_mute RPC (SECURITY DEFINER).
 */
export async function setChatMuteUntil(chatId: string, until: Date | null, muted = true) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('set_chat_mute', {
    p_chat_id: chatId,
    p_muted: muted,
    p_until: muted && until ? until.toISOString() : null,
  });
  if (error) throw error;
}

export async function getChatMuted(chatId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return false;

  const { data, error } = await supabase
    .from('chat_members')
    .select('muted, muted_until')
    .eq('chat_id', chatId)
    .eq('user_id', me.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.muted) return false;
  // A timed mute that has elapsed counts as unmuted.
  if (data.muted_until && new Date(data.muted_until).getTime() <= Date.now()) return false;
  return true;
}

/** Archive/unarchive a chat for yourself (hides it from the main list). */
export async function setChatArchived(chatId: string, archived: boolean) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('set_chat_archived', { p_chat_id: chatId, p_archived: archived });
  if (error) throw error;
}

/** Mark/unmark a chat as a favorite (for the Favorites filter). */
export async function setChatFavorite(chatId: string, favorite: boolean) {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).rpc('set_chat_favorite', { p_chat_id: chatId, p_favorite: favorite });
  if (error) throw error;
}

/** Add members to a group. Only the group's creator may do this (enforced by RLS). */
export async function addGroupMembers(chatId: string, memberIds: string[]) {
  if (memberIds.length === 0) return;
  const supabase = browserSupabase();
  const { error } = await supabase
    .from('chat_members')
    .insert(memberIds.map((user_id) => ({ chat_id: chatId, user_id })));
  if (error) throw error;

  // If the chat is encrypted, wrap the existing chat key for the new members.
  const { data: chatRow } = await supabase.from('chats').select('encrypted').eq('id', chatId).maybeSingle();
  if (chatRow?.encrypted) {
    for (const uid of memberIds) {
      try {
        await shareChatKeyWith(chatId, uid);
      } catch {
        // Best-effort; a member without a published key simply can't be added
        // to the encrypted key set until they set up encryption.
      }
    }
  }
}

/** List the user ids that are members of a chat. */
export async function getChatMemberIds(chatId: string): Promise<string[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase.from('chat_members').select('user_id').eq('chat_id', chatId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}

/** Whether a chat is end-to-end encrypted. */
export async function isChatEncrypted(chatId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data } = await supabase.from('chats').select('encrypted').eq('id', chatId).maybeSingle();
  return !!data?.encrypted;
}

/**
 * Whether outgoing content (messages AND media) for this chat must be encrypted:
 * true if the chat is already locked, or requires E2EE (new direct chats). Used
 * so media is encrypted before upload rather than leaking plaintext when the
 * fail-closed send would reject it.
 */
export async function chatMustEncrypt(chatId: string): Promise<boolean> {
  const supabase = browserSupabase();
  const { data } = await supabase.from('chats').select('encrypted, enc_required').eq('id', chatId).maybeSingle();
  return !!(data?.encrypted || data?.enc_required);
}

/**
 * Turn on E2EE for a chat: generate a chat key and wrap it for every member.
 * Returns { ok, missing } — if any member has not set up encryption yet, we
 * return their ids and do NOT lock the chat.
 */
export async function enableChatEncryption(chatId: string): Promise<{ ok: boolean; missing: string[] }> {
  const memberIds = await getChatMemberIds(chatId);
  return ksLockChat(chatId, memberIds);
}

/** Remove another member from a group. Only the group's creator may do this. */
export async function removeGroupMember(chatId: string, memberId: string) {
  const supabase = browserSupabase();
  const { error } = await supabase.rpc('remove_group_member', { p_chat_id: chatId, p_member_id: memberId });
  if (error) throw error;
}

export type GroupPerm = 'all' | 'admins';
export type GroupMeta = {
  myId: string;
  amAdmin: boolean;
  createdBy: string | null;
  roles: Record<string, 'admin' | 'member'>; // userId → role (creator counts as admin)
  perms: { edit: GroupPerm; add: GroupPerm; send: GroupPerm };
};

/** Load a group's roles + permissions, and whether I'm an admin. */
export async function getGroupMeta(chatId: string): Promise<GroupMeta> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  const myId = me.user?.id ?? '';
  // Cast: perm_* columns and chat_members.role aren't in the generated types yet.
  const sb = supabase as any;
  const [{ data: chat }, { data: cms }] = await Promise.all([
    sb.from('chats').select('created_by, perm_edit, perm_add, perm_send').eq('id', chatId).maybeSingle(),
    sb.from('chat_members').select('user_id, role').eq('chat_id', chatId),
  ]);
  const createdBy = (chat as any)?.created_by ?? null;
  const roles: Record<string, 'admin' | 'member'> = {};
  for (const r of (cms ?? []) as any[]) roles[r.user_id] = r.role === 'admin' ? 'admin' : 'member';
  if (createdBy) roles[createdBy] = 'admin'; // creator is always an admin
  const amAdmin = !!myId && (myId === createdBy || roles[myId] === 'admin');
  const perm = (v: unknown): GroupPerm => (v === 'admins' ? 'admins' : 'all');
  return {
    myId,
    amAdmin,
    createdBy,
    roles,
    perms: { edit: perm((chat as any)?.perm_edit), add: perm((chat as any)?.perm_add), send: perm((chat as any)?.perm_send) },
  };
}

/** Promote/demote a member (admin only; the creator is always an admin). */
export async function setGroupRole(chatId: string, memberId: string, role: 'admin' | 'member') {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).rpc('set_group_role', { p_chat_id: chatId, p_member_id: memberId, p_role: role });
  if (error) throw error;
}

/** Update a group's permissions (admin only). */
export async function setGroupPerms(chatId: string, perms: { edit: GroupPerm; add: GroupPerm; send: GroupPerm }) {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).rpc('set_group_perms', {
    p_chat_id: chatId,
    p_edit: perms.edit,
    p_add: perms.add,
    p_send: perms.send,
  });
  if (error) throw error;
}

/* ---------------------------- Group invite links ---------------------------- */

/** The group's current invite code (null = no active link). Members can read it. */
export async function getGroupInvite(chatId: string): Promise<string | null> {
  const sb = browserSupabase() as any;
  const { data } = await sb.from('chats').select('invite_code').eq('id', chatId).maybeSingle();
  return data?.invite_code ?? null;
}

/** Create or rotate the group's invite code (admin only). Returns the new code. */
export async function rotateGroupInvite(chatId: string): Promise<string> {
  const { data, error } = await (browserSupabase() as any).rpc('rotate_group_invite', { p_chat_id: chatId });
  if (error) throw error;
  return data as string;
}

/** Revoke the group's invite link (admin only). */
export async function revokeGroupInvite(chatId: string): Promise<void> {
  const { error } = await (browserSupabase() as any).rpc('revoke_group_invite', { p_chat_id: chatId });
  if (error) throw error;
}

export type InvitePreview = { chatId: string; title: string | null; avatarUrl: string | null; members: number };

/** Preview a group from an invite code (works for non-members). */
export async function groupInvitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await (browserSupabase() as any).rpc('group_invite_preview', { p_code: code });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return null;
  return { chatId: row.chat_id, title: row.title, avatarUrl: row.avatar_url, members: row.members };
}

/** Join a group via its invite code. Returns the chat id. */
export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await (browserSupabase() as any).rpc('join_group_by_code', { p_code: code });
  if (error) throw error;
  return data as string;
}

/** Build the shareable invite URL for a code (origin resolved at runtime). */
export function inviteLinkFor(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mobile-chat-mvp.vercel.app';
  return `${origin}/join?code=${encodeURIComponent(code)}`;
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
    .select('ciphertext, chat_id')
    .eq('id', messageId)
    .single();
  if (readErr) throw readErr;

  const env = parseEnvelope(msg.ciphertext);

  if (isEncryptedEnvelope(env)) {
    // Decrypt the current payload, swap the text, re-seal it.
    const currentPt = await decryptForChat(msg.chat_id, { iv: env.iv, ct: env.ct });
    let payload: Record<string, unknown> = {};
    try {
      payload = currentPt ? (JSON.parse(currentPt) as Record<string, unknown>) : {};
    } catch {}
    const sealed = await encryptForChat(msg.chat_id, JSON.stringify({ ...payload, text: newText }));
    if (!sealed) throw new Error('Encryption is locked on this device.');
    const { error } = await supabase
      .from('messages')
      .update({ content: null, ciphertext: JSON.stringify({ e: 1, ...sealed }), edited_at: new Date().toISOString() })
      .eq('id', messageId);
    if (error) throw error;
    return;
  }

  const payload = env ?? {};
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
 * Global message search across EVERY chat the user belongs to (no chat_id
 * filter — RLS scopes the result to the caller's own chats). Matches on the
 * server-readable `content` column, same as the per-chat search; messages that
 * are truly end-to-end sealed have `content = null` and are not searchable
 * server-side by design. Results are newest-first and carry their `chat_id` so
 * the caller can show which conversation each hit belongs to and jump to it.
 */
export async function searchAllMessages(query: string, limit = 40): Promise<MessageRow[]> {
  const q = query.trim();
  if (!q) return [];

  // Escape LIKE wildcards so a literal % or _ in the query doesn't match
  // everything. ESCAPE '\' is PostgREST's default for ilike.
  const safe = q.replace(/[\\%_]/g, (m) => `\\${m}`);

  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status, edited_at')
    .ilike('content', `%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as MessageRow[];
}

/**
 * Mark every incoming (not-mine) message across all my chats as "delivered".
 * Row-level security scopes the UPDATE to chats I'm a member of, so a single
 * statement safely fans out. Only bumps messages still at 'sent' — 'read' and
 * 'delivered' are left untouched. This is what lets a sender see ✓✓ (delivered)
 * even while the recipient hasn't opened the specific conversation.
 */
export async function markIncomingDelivered() {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;

  const { error } = await supabase
    .from('messages')
    .update({ delivery_status: 'delivered' })
    .eq('delivery_status', 'sent')
    .neq('sender_id', me.user.id);

  if (error) console.error(error);
}

/**
 * Mark the OTHER participants' messages in a chat as read — unless this user has
 * turned read receipts OFF, in which case we only advance them to "delivered"
 * so the sender never learns whether they were actually read.
 * Never touches your own messages (that's what makes ✓ vs ✓✓ meaningful).
 */
export async function markMessagesAsRead(chatId: string) {
  const supabase = browserSupabase();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;

  // Respect the viewer's read-receipts privacy preference.
  const { data: prof } = await supabase
    .from('profiles')
    .select('read_receipts')
    .eq('id', me.user.id)
    .maybeSingle();
  const sendReadReceipts = (prof as { read_receipts?: boolean } | null)?.read_receipts !== false;

  if (!sendReadReceipts) {
    // Privacy on: acknowledge delivery but never "read".
    const { error } = await supabase
      .from('messages')
      .update({ delivery_status: 'delivered' })
      .eq('chat_id', chatId)
      .eq('delivery_status', 'sent')
      .neq('sender_id', me.user.id);
    if (error) console.error(error);
    return;
  }

  // Groups: record a PER-MEMBER read. A DB trigger only flips the message to
  // "read" once every other member has read it, so the sender's ✓✓ turns green
  // only when the whole group has seen it (and can list who has).
  const { data: chat } = await supabase.from('chats').select('kind').eq('id', chatId).maybeSingle();
  if ((chat as { kind?: string } | null)?.kind === 'group') {
    // Cast: message_reads / mark_group_read aren't in the generated types yet.
    const { error } = await (supabase as any).rpc('mark_group_read', { p_chat_id: chatId });
    if (error) console.error(error);
    return;
  }

  // 1:1: the simple shared flag is enough (one reader == read).
  const { error } = await supabase
    .from('messages')
    .update({ read: true, delivery_status: 'read' })
    .eq('chat_id', chatId)
    .eq('read', false)
    .neq('sender_id', me.user.id);

  if (error) console.error(error);
}

/**
 * Who has read a given message, newest first, with their display name/avatar.
 * RLS limits this to members of the message's chat, so only participants (incl.
 * the sender) can see the "seen by" list.
 */
export async function getMessageReaders(
  messageId: string,
): Promise<{ userId: string; readAt: string; name: string; avatarUrl: string | null }[]> {
  const supabase = browserSupabase();
  // Cast: message_reads isn't in the generated types yet.
  const { data: reads, error } = await (supabase as any)
    .from('message_reads')
    .select('user_id, read_at')
    .eq('message_id', messageId)
    .order('read_at', { ascending: false });
  if (error || !reads || reads.length === 0) return [];

  const ids = (reads as any[]).map((r) => r.user_id as string);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', ids);
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return reads.map((r: any) => {
    const p = byId.get(r.user_id);
    return {
      userId: r.user_id,
      readAt: r.read_at,
      name: p?.display_name || p?.username || '',
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

/* ------------------------ View-once ("ver una vez") ------------------------ */

/**
 * Record that the current user opened a view-once message. The server ignores
 * the sender's own opens, so a sender never "uses up" their media. Idempotent.
 */
export async function markMessageViewed(messageId: string): Promise<void> {
  const supabase = browserSupabase();
  // Cast: mark_message_viewed isn't in the generated types yet.
  const { error } = await (supabase as any).rpc('mark_message_viewed', { p_message_id: messageId });
  if (error) throw error;
}

/**
 * All view-once opens recorded in a chat (members-only via RLS). Returns raw
 * rows so the caller can split them into "mine" (lock my own re-open) and
 * "others" (tell the sender it was opened).
 */
export async function getChatMessageViews(
  chatId: string,
): Promise<{ messageId: string; userId: string }[]> {
  const supabase = browserSupabase();
  // Cast: message_views isn't in the generated types yet.
  const { data, error } = await (supabase as any)
    .from('message_views')
    .select('message_id, user_id')
    .eq('chat_id', chatId);
  if (error || !data) return [];
  return (data as any[]).map((r) => ({ messageId: r.message_id as string, userId: r.user_id as string }));
}

/* ------------------------- Events / RSVPs ------------------------- */

export type EventRsvpStatus = 'going' | 'maybe' | 'no';

/** Set (or change) the current user's RSVP to an in-chat event. */
export async function setEventRsvp(
  messageId: string,
  chatId: string,
  status: EventRsvpStatus,
): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const { error } = await (supabase as any).from('event_rsvps').upsert(
    { message_id: messageId, chat_id: chatId, user_id: me.user.id, status, updated_at: new Date().toISOString() },
    { onConflict: 'message_id,user_id' },
  );
  if (error) throw error;
}

/** All RSVPs recorded in a chat (members-only via RLS). */
export async function getChatEventRsvps(
  chatId: string,
): Promise<{ messageId: string; userId: string; status: EventRsvpStatus }[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('event_rsvps')
    .select('message_id, user_id, status')
    .eq('chat_id', chatId);
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    messageId: r.message_id as string,
    userId: r.user_id as string,
    status: r.status as EventRsvpStatus,
  }));
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

  // Label the device by platform so the device manager reads clearly.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : 'Web';
  const label = `${platform} · ${new Date().toISOString().slice(0, 10)}`;

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
