'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type CallLog = {
  id: string;
  direction: 'outgoing' | 'incoming';
  missed: boolean;
  isVideo: boolean;
  isGroup: boolean;
  otherName: string;
  otherAvatar: string | null;
  otherUserId: string | null;
  chatId: string | null;
  startedAt: string;
};

/** The caller records a call when it starts, keyed by the WebRTC call id. */
export async function logCallStart(opts: {
  id: string;
  chatId?: string | null;
  peerId?: string | null;
  isVideo: boolean;
  isGroup: boolean;
}): Promise<void> {
  const supabase = browserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('calls').insert({
    id: opts.id,
    chat_id: opts.chatId ?? null,
    caller_id: user.id,
    peer_id: opts.isGroup ? null : opts.peerId ?? null,
    is_video: opts.isVideo,
    is_group: opts.isGroup,
  });
}

/** The callee marks the call answered when they accept it. */
export async function logCallAnswered(id: string): Promise<void> {
  const supabase = browserSupabase();
  await supabase.from('calls').update({ answered: true }).eq('id', id);
}

/** The caller stamps the end time when the call finishes. */
export async function logCallEnded(id: string): Promise<void> {
  const supabase = browserSupabase();
  await supabase.from('calls').update({ ended_at: new Date().toISOString() }).eq('id', id);
}

/** Recent calls involving the current user, newest first, ready for display. */
export async function listCalls(): Promise<CallLog[]> {
  const supabase = browserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const myId = user.id;

  const { data: rows, error } = await supabase
    .from('calls')
    .select('id, chat_id, caller_id, peer_id, is_video, is_group, answered, started_at')
    .order('started_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const userIds = new Set<string>();
  const chatIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.caller_id);
    if (r.peer_id) userIds.add(r.peer_id);
    if (r.is_group && r.chat_id) chatIds.add(r.chat_id);
  }

  const [{ data: profs }, { data: chatsData }] = await Promise.all([
    supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', [...userIds]),
    chatIds.size
      ? supabase.from('chats').select('id, title, avatar_url').in('id', [...chatIds])
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profById = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null }>();
  for (const p of profs ?? []) profById.set(p.id, p);
  const chatById = new Map<string, { title: string | null; avatar_url: string | null }>();
  for (const c of chatsData ?? []) chatById.set(c.id, c);

  return rows.map((r) => {
    const direction: CallLog['direction'] = r.caller_id === myId ? 'outgoing' : 'incoming';
    if (r.is_group) {
      const c = r.chat_id ? chatById.get(r.chat_id) : null;
      return {
        id: r.id,
        direction,
        missed: !r.answered,
        isVideo: r.is_video,
        isGroup: true,
        otherName: c?.title || 'Group',
        otherAvatar: c?.avatar_url ?? null,
        otherUserId: null,
        chatId: r.chat_id,
        startedAt: r.started_at,
      };
    }
    const otherId = direction === 'outgoing' ? r.peer_id : r.caller_id;
    const p = otherId ? profById.get(otherId) : null;
    return {
      id: r.id,
      direction,
      missed: !r.answered,
      isVideo: r.is_video,
      isGroup: false,
      otherName: p?.display_name || p?.username || '—',
      otherAvatar: p?.avatar_url ?? null,
      otherUserId: otherId ?? null,
      chatId: r.chat_id,
      startedAt: r.started_at,
    };
  });
}
