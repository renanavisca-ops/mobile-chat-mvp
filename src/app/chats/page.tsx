'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

import { BottomNav } from '@/components/page-shell';
import { StoriesBar } from '@/components/stories-bar';
import { ChatConversation } from '@/components/chat-conversation';
import { PlusIcon, SearchIcon, UsersIcon, UserPlusIcon, HashIcon, ChatBubbleIcon } from '@/components/icons';
import { ChatListSkeleton } from '@/components/skeleton';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { ensureIdentity } from '@/lib/crypto/keystore';
import { browserSupabase } from '@/lib/supabase/client';
import { listChats, markIncomingDelivered, setChatArchived } from '@/lib/db/chats';
import { getCached, setCached } from '@/lib/cache';
import { tap, impact } from '@/lib/haptics';
import { useIsOnline } from '@/components/presence-provider';
import { useLanguage } from '@/lib/i18n/context';
import { avatarBg, initials } from '@/lib/ui/avatar';

import type { ChatSummary } from '@/lib/db/types';

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
  // Distinct from the auth `loading` flag: tracks whether the chats fetch itself
  // has completed at least once. Without this the empty state ("no chats yet")
  // flashes after auth resolves but before listChats() returns.
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [err, setErr] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [, setUnreadCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [rowMenuChat, setRowMenuChat] = useState<ChatSummary | null>(null);
  const rowPressTimer = useRef<number | null>(null);
  const justLongPressed = useRef(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

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

  const reloadChats = () => {
    listChats()
      .then((rows) => {
        setChats(rows);
        if (user) setCached(`chats:${user.id}`, rows);
      })
      .catch((e) => setErr(e?.message ?? String(e)));
  };

  // Paint the last-known chat list instantly from cache, then refresh in the
  // background (below). Skips the skeleton on repeat/cold visits.
  useEffect(() => {
    if (!user) return;
    const cached = getCached<ChatSummary[]>(`chats:${user.id}`);
    if (cached && cached.length) {
      setChats(cached);
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
    if (isWide()) setSelectedId(id);
    else router.push(`/chats/${id}`);
  }

  useEffect(() => {
    // Wait for auth before fetching so we don't run an unauthenticated query
    // and briefly render the empty state before the real list arrives.
    if (loading || !user || !profile) return;

    let reloadTimer: number | null = null;
    const load = () => {
      listChats()
        .then((rows) => {
          setChats(rows);
          setCached(`chats:${user.id}`, rows);
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

    const messagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        scheduleReload();
      })
      .subscribe();

    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      void browserSupabase().removeChannel(channel);
      void browserSupabase().removeChannel(messagesChannel);
    };
  }, [loading, user, profile]);

  // Auto-open the first chat on wide screens so the right pane isn't empty.
  useEffect(() => {
    if (selectedId || !chats.length) return;
    if (isWide()) setSelectedId(chats[0].id);
  }, [chats, selectedId]);

  function statusLabel(status: string | undefined) {
    if (status === 'open') return t('common.statusOpen');
    if (status === 'in_progress') return t('common.statusInProgress');
    if (status === 'closed') return t('common.statusClosed');
    return status ?? '';
  }

  function preview(c: ChatSummary): string {
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
      case 'poll':
        return t('chatsList.poll');
      case 'file':
        return t('chatsList.file');
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
                      <Link href="/channels" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-900">
                        <HashIcon size={18} /> {t('nav.channels')}
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

            {err ? <p className="text-sm text-red-300">{err}</p> : null}

            {loading || !chatsLoaded ? (
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
            ) : chats.filter((c) => (c.title || '').toLowerCase().includes(search.trim().toLowerCase())).length === 0 ? (
              <p className="p-3 text-sm text-slate-400">{t('emoji.noMatches')}</p>
            ) : (() => {
              const searched = chats.filter((c) => (c.title || '').toLowerCase().includes(search.trim().toLowerCase()));
              const archivedList = searched.filter((c) => c.archived);
              // Unread chats stay pinned above read ones; within each group the
              // most recent is first. As a chat is read (unread_count → 0) it
              // drops below the last still-unread chat.
              const ts = (c: ChatSummary) => (c.last_message_at ? new Date(c.last_message_at).getTime() : 0);
              const byUnreadThenRecent = (a: ChatSummary, b: ChatSummary) => {
                const au = (a.unread_count ?? 0) > 0 ? 1 : 0;
                const bu = (b.unread_count ?? 0) > 0 ? 1 : 0;
                if (au !== bu) return bu - au;
                return ts(b) - ts(a);
              };
              const visible = (showArchived ? archivedList : searched.filter((c) => !c.archived))
                .slice()
                .sort(byUnreadThenRecent);
              return (
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
                  const unread = c.unread_count ?? 0;
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
              );
            })()}
          </div>
        </aside>

        {/* RIGHT — conversation pane (wide screens only) */}
        <section className="hidden min-w-0 flex-1 lg:flex">
          {selectedId ? (
            <ChatConversation key={selectedId} chatId={selectedId} embedded />
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

      <BottomNav />
    </div>
  );
}
