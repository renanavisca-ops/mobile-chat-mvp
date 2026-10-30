'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

import { BottomNav } from '@/components/page-shell';
import { StoriesBar } from '@/components/stories-bar';
import { ChatConversation } from '@/components/chat-conversation';
import { PlusIcon, SearchIcon, UsersIcon, UserPlusIcon, HashIcon, ChatBubbleIcon, SpeakerIcon } from '@/components/icons';
import { ChatListSkeleton } from '@/components/skeleton';
import { EffectsIntro } from '@/components/effects-intro';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { ensureIdentity } from '@/lib/crypto/keystore';
import { browserSupabase } from '@/lib/supabase/client';
import { listChats, markIncomingDelivered, setChatArchived, setChatFavorite, getOrCreateSelfChat, searchAllMessages } from '@/lib/db/chats';
import { isChatLocked } from '@/lib/chat-lock';
import { getCached, setCached } from '@/lib/cache';
import { tap, impact } from '@/lib/haptics';
import { useIsOnline } from '@/components/presence-provider';
import { useLanguage } from '@/lib/i18n/context';
import { avatarBg, initials } from '@/lib/ui/avatar';
import { highlightSnippet } from '@/lib/ui/highlight';

import type { ChatSummary, MessageRow } from '@/lib/db/types';

// Compact, chat-list-style timestamp: "now", "8m", "3h", "Mon", or a short
// date once it's older than a week — instead of a noisy full locale datetime.
function fmt(ts: string | null, locale: string) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'now';
  if (diff < hour) return `${Math.floor(diff / min)}m`;
  if (diff < day && d.getDate() === new Date().getDate()) {
    return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 7 * day) return d.toLocaleDateString(locale, { weekday: 'short' });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function Avatar({
  url,
  name,
  online,
}: {
  url?: string | null;
  name?: string | null;
  online?: boolean;
}) {
  return (
    <span className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-black/10" />
      ) : (
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl text-base font-bold tracking-tight text-white shadow-sm shadow-black/25 ring-1 ring-white/20"
          style={{ backgroundImage: avatarBg(name) }}
        >
          {initials(name)}
        </span>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-500" />
      )}
    </span>
  );
}

// Tiny trust/affordance glyphs shown inline next to a chat title.
function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" className="shrink-0 text-emerald-400" aria-hidden>
      <path fill="currentColor" d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5m3 8H9V6a3 3 0 0 1 6 0z" />
    </svg>
  );
}
function TimerGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" className="shrink-0 text-slate-500" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </svg>
  );
}
function ArchiveGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </svg>
  );
}

// Reads live presence for a direct chat's counterpart and renders the avatar
// with an online indicator.
function ChatAvatar({ chat }: { chat: ChatSummary }) {
  const online = useIsOnline(chat.kind === 'direct' ? chat.other_user_id : null);
  return (
    <Avatar
      url={chat.kind === 'direct' ? chat.other_user_avatar : chat.avatar_url}
      name={chat.title}
      online={chat.kind === 'direct' ? !!online : false}
    />
  );
}

function isWide() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
}

export default function ChatsPage() {
  const { loading, profile, user } = useRequireAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  // Latest chats, readable from effects that must NOT re-run when the list
  // changes (freezing the opened chat's unread status at the moment of opening).
  const chatsRef = useRef<ChatSummary[]>([]);
  chatsRef.current = chats;
  // Distinct from the auth `loading` flag: tracks whether the chats fetch itself
  // has completed at least once. Without this the empty state ("no chats yet")
  // flashes after auth resolves but before listChats() returns.
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [err, setErr] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Whether the chat you're currently viewing was UNREAD when you opened it.
  // While it's open we keep it in its original (unread) spot so it doesn't slide
  // down under you; it drops to time order only once you leave it.
  const [openedWhileUnread, setOpenedWhileUnread] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  // Global message search (across ALL chats, not just the open one). Results are
  // messages whose text matches; tapping one opens that chat at that message.
  const [msgResults, setMsgResults] = useState<MessageRow[]>([]);
  const [msgSearching, setMsgSearching] = useState(false);
  // sender id -> display name, for labelling who sent each global-search hit.
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  // When opening a chat at a specific message in the embedded (wide-screen)
  // pane, this carries the target message id so the conversation can jump to it.
  const [focusMsgId, setFocusMsgId] = useState<string | null>(null);
  const [, setUnreadCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [rowMenuChat, setRowMenuChat] = useState<ChatSummary | null>(null);
  const rowPressTimer = useRef<number | null>(null);
  const justLongPressed = useRef(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  // Read-guard: chats we've just read, mapped to the newest message time that was
  // read. A background refetch can race ahead of markMessagesAsRead's commit and
  // momentarily report the chat as unread again (the "read → drops down → unread
  // again" flip). We keep such a chat at 0 unread until a STRICTLY newer message
  // arrives (last_message_at advances past the guarded time), which is the only
  // legitimate way it can become unread again. Self-clears once the server agrees.
  const readGuardRef = useRef<Map<string, string>>(new Map());
  const prevSelectedRef = useRef<string | null>(null);
  const applyReadGuard = (rows: ChatSummary[]): ChatSummary[] =>
    rows.map((c) => {
      const g = readGuardRef.current.get(c.id);
      if (g === undefined) return c;
      const lm = c.last_message_at ?? '';
      if (lm > g) {
        // A genuinely newer message arrived — stop guarding, trust the server.
        readGuardRef.current.delete(c.id);
        return c;
      }
      if ((c.unread_count ?? 0) === 0) {
        // Server has caught up to our read; guard no longer needed.
        readGuardRef.current.delete(c.id);
        return c;
      }
      // Stale race: keep it read.
      return { ...c, unread_count: 0 };
    });

  // Close the "new chat" (+) menu on any tap outside it. A document listener
  // (not a fixed backdrop) is required because the glass header's backdrop-filter
  // would contain a fixed catcher to the header strip only.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!newMenuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  // Debounced global message search: when the query has 2+ chars, look for
  // matching messages across every chat (RLS keeps it to the user's own).
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setMsgResults([]);
      setMsgSearching(false);
      return;
    }
    setMsgSearching(true);
    const id = window.setTimeout(() => {
      searchAllMessages(q)
        .then(setMsgResults)
        .catch(() => setMsgResults([]))
        .finally(() => setMsgSearching(false));
    }, 250);
    return () => window.clearTimeout(id);
  }, [search]);

  // Resolve the display name of each sender appearing in the message results,
  // so a hit can show WHO sent it (not just which chat).
  useEffect(() => {
    const ids = Array.from(new Set(msgResults.map((r) => r.sender_id).filter(Boolean))) as string[];
    if (ids.length === 0) {
      setSenderNames({});
      return;
    }
    let alive = true;
    browserSupabase()
      .from('profiles')
      .select('id, display_name, username')
      .in('id', ids)
      .then(({ data }) => {
        if (!alive || !data) return;
        const map: Record<string, string> = {};
        for (const p of data as Array<{ id: string; display_name: string | null; username: string | null }>) {
          map[p.id] = p.display_name || p.username || '';
        }
        setSenderNames(map);
      });
    return () => {
      alive = false;
    };
  }, [msgResults]);

  const reloadChats = () => {
    listChats()
      .then((rows) => {
        const guarded = applyReadGuard(rows);
        setChats(guarded);
        if (user) setCached(`chats:${user.id}`, guarded);
      })
      .catch((e) => setErr(e?.message ?? String(e)));
  };

  // Ensure every user has their "Notes to self" chat automatically — created on
  // first load if they don't have one yet, so it just appears (pinned at the
  // top) without having to open "Notas personales" by hand. Idempotent:
  // getOrCreateSelfChat reuses an existing self-chat, and this only fires when
  // none is present. Runs once per session.
  const selfEnsuredRef = useRef(false);
  useEffect(() => {
    if (!user || !chatsLoaded || selfEnsuredRef.current) return;
    if (chats.some((c) => c.is_self)) {
      selfEnsuredRef.current = true;
      return;
    }
    selfEnsuredRef.current = true;
    getOrCreateSelfChat(t('chatsList.selfNotes'))
      .then(() => reloadChats())
      .catch(() => {
        selfEnsuredRef.current = false; // allow a retry on a later render
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, chatsLoaded, chats]);

  // Paint the last-known chat list instantly from cache, then refresh in the
  // background (below). Skips the skeleton on repeat/cold visits.
  useEffect(() => {
    if (!user) return;
    const cached = getCached<ChatSummary[]>(`chats:${user.id}`);
    if (cached && cached.length) {
      setChats(applyReadGuard(cached));
      setChatsLoaded(true);
    }
  }, [user]);

  function startRowPress(c: ChatSummary) {
    if (rowPressTimer.current) window.clearTimeout(rowPressTimer.current);
    rowPressTimer.current = window.setTimeout(() => {
      impact();
      justLongPressed.current = true;
      setRowMenuChat(c);
      rowPressTimer.current = null;
    }, 450);
  }
  function cancelRowPress() {
    if (rowPressTimer.current) {
      window.clearTimeout(rowPressTimer.current);
      rowPressTimer.current = null;
    }
  }
  async function toggleArchive(c: ChatSummary) {
    setRowMenuChat(null);
    tap();
    try {
      await setChatArchived(c.id, !c.archived);
      reloadChats();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }
  async function toggleFavorite(c: ChatSummary) {
    setRowMenuChat(null);
    tap();
    const next = !c.favorite;
    setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, favorite: next } : x)));
    try {
      await setChatFavorite(c.id, next);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      reloadChats();
    }
  }
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
  }, []);

  // Make sure this account has an encryption identity (covers users who signed
  // up before encryption-by-default), so their new direct chats can lock.
  useEffect(() => {
    if (user) void ensureIdentity().catch(() => {});
  }, [user]);

  // On wide screens, open a chat in the right pane; on phones, navigate to the
  // full-page conversation.
  function openChat(id: string) {
    setFocusMsgId(null);
    if (isWide()) setSelectedId(id);
    else router.push(`/chats/view?c=${id}`);
  }

  // Open a chat scrolled to a specific message (from the global search).
  function openChatAtMessage(chatId: string, messageId: string) {
    if (isWide()) {
      setFocusMsgId(messageId);
      setSelectedId(chatId);
    } else {
      router.push(`/chats/view?c=${chatId}&m=${messageId}`);
    }
  }

  useEffect(() => {
    // Wait for auth before fetching so we don't run an unauthenticated query
    // and briefly render the empty state before the real list arrives.
    if (loading || !user || !profile) return;

    let reloadTimer: number | null = null;
    const load = () => {
      listChats()
        .then((rows) => {
          const guarded = applyReadGuard(rows);
          setChats(guarded);
          setCached(`chats:${user.id}`, guarded);
        })
        .catch((e) => setErr(e?.message ?? String(e)))
        .finally(() => setChatsLoaded(true));
      // Acknowledge delivery of any incoming messages while the app is open,
      // even for chats the user hasn't opened yet (RLS scopes this to my chats).
      void markIncomingDelivered().catch(() => {});
    };
    // Coalesce bursts: a flurry of incoming messages triggers ONE refresh, not
    // one heavy listChats() per message.
    const scheduleReload = () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(load, 400);
    };
    load();

    const supabase = browserSupabase();

    const channel = supabase
      .channel('public:chats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        (payload: any) => {
          const newRow = payload.new;
          if (!newRow) return;
          if (payload.eventType !== 'INSERT') return;

          if (profile.role === 'agent') {
            if (newRow.assigned_to === user.id) {
              setUnreadCount((prev) => prev + 1);
              audioRef.current?.play().catch(() => {});
              scheduleReload();
            }
            return;
          }
          if (profile.role === 'admin') {
            if (newRow.store_id === profile.store_id) scheduleReload();
            return;
          }
          scheduleReload();
        }
      )
      .subscribe();

    // React to inserts (new message → preview/order) AND updates (read /
    // delivery status → unread count). Listening to updates is what keeps the
    // unread state in sync across a user's devices: reading on the phone clears
    // it on the web and vice versa. scheduleReload() coalesces the burst of
    // per-row UPDATEs from one "mark as read" into a single refetch.
    const messagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        scheduleReload();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        scheduleReload();
      })
      .subscribe();

    // Reading a GROUP message records a per-member read (message_reads INSERT)
    // instead of flipping messages.read, so the messages channel above never
    // fires for it. Listen to my own reads too, so a group I just read refetches
    // and drops out of the unread group (and clears across my devices).
    const readsChannel = supabase
      .channel('public:message_reads')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reads', filter: `user_id=eq.${user.id}` },
        () => {
          scheduleReload();
        },
      )
      .subscribe();

    // Catch-up on resume. Realtime (postgres_changes) does NOT replay events
    // missed while the tab was hidden / the phone was backgrounded, so reading a
    // chat on another device wouldn't clear its unread badge here until some new
    // event happened. Refetch whenever we come back to the foreground so unread
    // counts reconcile across devices (mirrors the message thread's catch-up).
    const onResume = () => {
      if (document.visibilityState === 'visible') scheduleReload();
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);

    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
      void browserSupabase().removeChannel(channel);
      void browserSupabase().removeChannel(messagesChannel);
      void browserSupabase().removeChannel(readsChannel);
    };
  }, [loading, user, profile]);

  // Auto-open the first chat on wide screens so the right pane isn't empty.
  useEffect(() => {
    if (selectedId || !chats.length) return;
    if (isWide()) setSelectedId(chats[0].id);
  }, [chats, selectedId]);

  // Opening a chat marks it read (an UPDATE), but the list's realtime is
  // INSERT-only, so it never refetches on a read. Clear the opened chat's unread
  // badge instantly here, then reconcile with the server once
  // markMessagesAsRead has run — otherwise a read chat keeps showing as unread on
  // the desktop/web split view where the list stays mounted.
  useEffect(() => {
    // Guard the chat we're LEAVING as fully read up to its latest message, so a
    // racing refetch can't resurrect its badge after it correctly dropped to time
    // order. (Everything up to now was read while it was open.)
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedId) {
      const pc = chatsRef.current.find((c) => c.id === prev);
      readGuardRef.current.set(prev, pc?.last_message_at ?? new Date().toISOString());
    }
    prevSelectedRef.current = selectedId;

    if (!selectedId) {
      setOpenedWhileUnread(false);
      return;
    }
    // Freeze (from a ref, so this doesn't re-run as the list updates) whether the
    // chat was unread when opened, to hold its position while it's on screen.
    const opened = chatsRef.current.find((c) => c.id === selectedId);
    setOpenedWhileUnread((opened?.unread_count ?? 0) > 0);
    // Guard the chat we're opening too (covers the phone flow, where opening
    // navigates away and this list may refetch before the read commits).
    readGuardRef.current.set(selectedId, opened?.last_message_at ?? new Date().toISOString());
    if (!user) return;
    // Clear its badge immediately (it's being read now); position is held by the
    // sort below until you leave it. Marking-as-read emits realtime UPDATEs that
    // the list subscription turns into a single refetch, so the server-confirmed
    // count lands without a race.
    setChats((prev) => {
      if (!prev.some((c) => c.id === selectedId && (c.unread_count ?? 0) > 0)) return prev;
      const next = prev.map((c) => (c.id === selectedId ? { ...c, unread_count: 0 } : c));
      try { setCached(`chats:${user.id}`, next); } catch {}
      return next;
    });
  }, [selectedId, user]);

  function statusLabel(status: string | undefined) {
    if (status === 'open') return t('common.statusOpen');
    if (status === 'in_progress') return t('common.statusInProgress');
    if (status === 'closed') return t('common.statusClosed');
    return status ?? '';
  }

  function preview(c: ChatSummary): string {
    if (isChatLocked(c.id)) return `🔒 ${t('chatLock.listLocked')}`;
    switch (c.last_message_kind) {
      case 'text':
        return c.last_ciphertext ?? '';
      case 'photo':
        return t('chatsList.photo');
      case 'video':
        return t('chatsList.video');
      case 'audio':
        return t('chatsList.audio');
      case 'gif':
        return t('chatsList.gif');
      case 'sticker':
        return t('chatsList.sticker');
      case 'contact':
        return t('chatsList.contact');
      case 'location':
        return t('chatsList.location');
      case 'event':
        return t('chatsList.event');
      case 'poll':
        return t('chatsList.poll');
      case 'file':
        return t('chatsList.file');
      case 'call':
        return t('chatsList.call');
      case 'deleted':
        return t('chatsList.deletedMessage');
      default:
        return t('chatsList.noMessagesYet');
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-50">
      {/* Reserve space for the fixed bottom nav so the conversation composer
          isn't hidden behind it. Fill the full width on wide screens. */}
      <div className="flex min-h-0 w-full flex-1 pb-[calc(3.75rem+env(safe-area-inset-bottom))]">
        {/* LEFT — conversation list */}
        <aside className="flex min-h-0 w-full flex-col lg:w-96 lg:shrink-0 lg:border-r lg:border-slate-900">
          <header className="toky-glass sticky top-0 z-20 flex flex-col gap-2.5 border-b border-slate-800/70 px-3 py-3 pt-safe">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                <span className="toky-grad-text">{t('chatsList.title')}</span>
              </h1>
              <div className="relative" ref={newMenuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="toky-grad toky-ring-brand grid h-10 w-10 place-items-center rounded-full text-white"
                  aria-label={t('chatsList.newChat')}
                >
                  <PlusIcon size={22} />
                </button>
                {menuOpen && (
                  <>
                    <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-black/50 py-1.5">
                      <Link href="/contacts" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <UsersIcon size={18} /> {t('nav.contacts')}
                      </Link>
                      <Link href="/contacts" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <UserPlusIcon size={18} /> {t('chatsList.newChat')}
                      </Link>
                      <Link href="/groups/new" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <UsersIcon size={18} /> {t('nav.newGroup')}
                      </Link>
                      <Link href="/broadcast" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <SpeakerIcon size={18} /> {t('broadcast.title')}
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          setMenuOpen(false);
                          try {
                            const id = await getOrCreateSelfChat(t('chatsList.selfNotes'));
                            router.push(`/chats/view?c=${id}`);
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-900"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        {t('chatsList.selfNotes')}
                      </button>
                      <Link href="/channels" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <HashIcon size={18} /> {t('nav.channels')}
                      </Link>
                      <Link href="/communities" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <UsersIcon size={18} /> {t('nav.communities')}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Search chats */}
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3.5 py-2 text-slate-400 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20">
              <SearchIcon size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('chatsList.searchPlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
            {!search && <StoriesBar />}

            {!search && !showArchived && chats.length > 0 && (
              <div className="mb-1 flex gap-2 overflow-x-auto pb-1">
                {([
                  ['all', 'chatsList.filterAll'],
                  ['unread', 'chatsList.filterUnread'],
                  ['favorites', 'chatsList.filterFavorites'],
                  ['groups', 'chatsList.filterGroups'],
                ] as const).map(([key, labelKey]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                      filter === key ? 'toky-grad text-white' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            )}

            {err ? <p className="text-sm text-red-300">{err}</p> : null}

            {(loading || !chatsLoaded) && chats.length === 0 ? (
              <ChatListSkeleton rows={8} />
            ) : chats.length === 0 ? (
              <div className="mt-10 flex flex-col items-center px-6 text-center">
                <div className="toky-grad toky-ring-brand grid h-16 w-16 place-items-center rounded-3xl text-white">
                  <ChatBubbleIcon size={30} />
                </div>
                <p className="mt-4 font-display text-lg font-bold">{t('chatsList.noChatsYet')}</p>
                <Link
                  className="toky-grad toky-ring-brand mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                  href="/contacts"
                >
                  <UserPlusIcon size={18} /> {t('chatsList.goToContacts')}
                </Link>
              </div>
            ) : (() => {
              const q = search.trim();
              const isSearching = q.length > 0;
              const chatById = new Map(chats.map((c) => [c.id, c] as const));
              const searched = chats.filter((c) => (c.title || '').toLowerCase().includes(q.toLowerCase()));
              const archivedList = searched.filter((c) => c.archived);
              // Unread chats stay pinned above read ones; within each group the
              // most recent is first. The chat you're currently viewing HOLDS its
              // spot while open — if it was unread when opened it stays in the
              // unread group (so it doesn't slide down under you), and only drops
              // to time order once you leave it. Its badge still clears (it's read).
              const effUnread = (c: ChatSummary) =>
                c.id === selectedId ? (openedWhileUnread ? 1 : 0) : (c.unread_count ?? 0);
              const ts = (c: ChatSummary) => (c.last_message_at ? new Date(c.last_message_at).getTime() : 0);
              // Only your personal notes chat is pinned to the very top. The
              // news channel is NOT pinned: it behaves like any other chat, so
              // it rises to the top when a new update is posted (unread) and
              // then drops back into time order once read.
              const pinRank = (c: ChatSummary) => (c.is_self ? 0 : 1);
              const byUnreadThenRecent = (a: ChatSummary, b: ChatSummary) => {
                const pa = pinRank(a);
                const pb = pinRank(b);
                if (pa !== pb) return pa - pb;
                const au = effUnread(a) > 0 ? 1 : 0;
                const bu = effUnread(b) > 0 ? 1 : 0;
                if (au !== bu) return bu - au;
                return ts(b) - ts(a);
              };
              // Filter chips apply only to the normal (non-search, non-archived) list.
              const matchesFilter = (c: ChatSummary) => {
                if (filter === 'unread') return (c.unread_count ?? 0) > 0 || (c.id === selectedId && openedWhileUnread);
                if (filter === 'favorites') return !!c.favorite;
                if (filter === 'groups') return c.kind === 'group' && !c.is_self;
                return true;
              };
              const base = showArchived ? archivedList : searched.filter((c) => !c.archived);
              const visible = (isSearching || showArchived ? base : base.filter(matchesFilter))
                .slice()
                .sort(byUnreadThenRecent);
              return (
              <>
                {isSearching && visible.length > 0 && (
                  <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {t('chatsList.sectionChats')}
                  </div>
                )}
                {visible.length === 0 && isSearching ? (
                  <p className="px-3 py-1 text-[13px] text-slate-500">{t('chatsList.noChatNameMatches')}</p>
                ) : visible.length === 0 && !isSearching && !showArchived && filter !== 'all' ? (
                  <p className="px-3 py-6 text-center text-[13px] text-slate-500">{t('chatsList.noFilterMatches')}</p>
                ) : (
                <ul className="space-y-0.5">
                {showArchived ? (
                  <li>
                    <button
                      onClick={() => setShowArchived(false)}
                      className="flex w-full items-center gap-2 rounded-2xl p-2.5 text-left text-sm font-semibold text-blue-300 hover:bg-slate-900/70"
                    >
                      <span className="text-lg leading-none">‹</span> {t('chatsList.backToChats')}
                    </button>
                  </li>
                ) : archivedList.length > 0 ? (
                  <li>
                    <button
                      onClick={() => setShowArchived(true)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl p-2.5 text-left hover:bg-slate-900/70"
                    >
                      <span className="flex items-center gap-3 text-sm font-medium text-slate-300">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800 text-slate-400">
                          <ArchiveGlyph />
                        </span>
                        {t('chatsList.archived')}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{archivedList.length}</span>
                    </button>
                  </li>
                ) : null}
                {visible.map((c, i) => {
                  const active = c.id === selectedId;
                  // The open chat reads as read (no badge, not bold) even before
                  // the server refetch lands.
                  const unread = active ? 0 : (c.unread_count ?? 0);
                  return (
                    <li key={c.id} className="toky-rise" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
                      <button
                        onClick={() => {
                          if (justLongPressed.current) { justLongPressed.current = false; return; }
                          openChat(c.id);
                        }}
                        onPointerDown={() => startRowPress(c)}
                        onPointerUp={cancelRowPress}
                        onPointerLeave={cancelRowPress}
                        onPointerCancel={cancelRowPress}
                        onContextMenu={(e) => { e.preventDefault(); setRowMenuChat(c); }}
                        className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${
                          active ? 'bg-slate-800/80 shadow-sm' : 'hover:bg-slate-900/70 active:bg-slate-900'
                        }`}
                      >
                        <ChatAvatar chat={c} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className={`truncate ${unread > 0 ? 'font-extrabold text-white' : 'font-semibold'}`}>
                                {c.kind === 'group' ? c.title ?? t('chatsList.group') : c.title ?? t('chatsList.directChat')}
                              </span>
                              {c.favorite && <span className="shrink-0 text-xs text-amber-300" title={t('chatsList.favorite')}>★</span>}
                              {c.encrypted && <LockGlyph />}
                              {!!c.disappearing_seconds && <TimerGlyph />}
                              {c.store_id && c.status && (
                                <span
                                  className={`ml-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                    c.status === 'open'
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : c.status === 'in_progress'
                                      ? 'bg-blue-500/15 text-blue-400'
                                      : 'bg-slate-700/50 text-slate-400'
                                  }`}
                                >
                                  {statusLabel(c.status)}
                                </span>
                              )}
                            </div>
                            <div className={`shrink-0 text-xs font-medium ${unread > 0 ? 'text-blue-400' : 'text-slate-500'}`}>{fmt(c.last_message_at, lang)}</div>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <div className={`min-w-0 flex-1 truncate text-[13px] ${unread > 0 ? 'font-medium text-slate-200' : 'text-slate-400'}`}>{preview(c)}</div>
                            {unread > 0 && (
                              <span className="toky-grad grid h-5 min-w-[1.25rem] shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
                )}
                {isSearching && q.length >= 2 && (
                  <div className="mt-2">
                    <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {t('chatsList.sectionMessages')}
                    </div>
                    {msgSearching && msgResults.length === 0 ? (
                      <p className="px-3 py-1 text-[13px] text-slate-500">{t('chatsList.searchingMessages')}</p>
                    ) : msgResults.length === 0 ? (
                      <p className="px-3 py-1 text-[13px] text-slate-500">{t('chatsList.noMessageMatches')}</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {msgResults.map((r) => {
                          const chat = chatById.get(r.chat_id);
                          const senderLabel =
                            r.sender_id && user && r.sender_id === user.id
                              ? t('chatsList.you')
                              : (r.sender_id && senderNames[r.sender_id]) || t('chat.someone');
                          return (
                            <li key={r.id}>
                              <button
                                onClick={() => openChatAtMessage(r.chat_id, r.id)}
                                className="flex w-full items-start gap-3 rounded-2xl p-2.5 text-left hover:bg-slate-900/70 active:bg-slate-900"
                              >
                                {chat ? (
                                  <ChatAvatar chat={chat} />
                                ) : (
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-400">
                                    <ChatBubbleIcon size={18} />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="truncate text-sm font-semibold">
                                      {chat?.title || t('chatsList.directChat')}
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-500">{fmt(r.created_at, lang)}</span>
                                  </div>
                                  <div className="mt-0.5 truncate text-[13px] text-slate-400">
                                    <span className="font-medium text-slate-300">{senderLabel}: </span>
                                    {highlightSnippet(r.content, q)}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </>
              );
            })()}
          </div>
        </aside>

        {/* RIGHT — conversation pane (wide screens only) */}
        <section className="hidden min-w-0 flex-1 lg:flex">
          {selectedId ? (
            <ChatConversation key={selectedId} chatId={selectedId} embedded focusMessageId={focusMsgId} />
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center text-sm text-slate-500">
              {t('chatsList.pickChat')}
            </div>
          )}
        </section>
      </div>

      {rowMenuChat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setRowMenuChat(null)}>
          <div
            className="toky-glass toky-elev w-full max-w-md rounded-t-3xl border border-slate-800 p-2 pb-safe sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pb-2 pt-3 text-sm font-semibold text-slate-300 truncate">
              {rowMenuChat.title || t('chatsList.directChat')}
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(rowMenuChat)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-slate-800/60"
            >
              <span className={rowMenuChat.favorite ? 'text-amber-300' : 'text-slate-400'}>★</span>
              {rowMenuChat.favorite ? t('chatsList.unfavorite') : t('chatsList.favorite')}
            </button>
            <button
              type="button"
              onClick={() => toggleArchive(rowMenuChat)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-slate-800/60"
            >
              <ArchiveGlyph />
              {rowMenuChat.archived ? t('chatsList.unarchive') : t('chatsList.archive')}
            </button>
            <button
              type="button"
              onClick={() => setRowMenuChat(null)}
              className="mt-1 flex w-full items-center justify-center rounded-2xl px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800/40"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <EffectsIntro />

      <BottomNav />
    </div>
  );
}
