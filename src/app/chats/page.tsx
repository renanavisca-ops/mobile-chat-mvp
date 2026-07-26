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
import { listChats, markIncomingDelivered } from '@/lib/db/chats';
import { useIsOnline } from '@/components/presence-provider';
import { useLanguage } from '@/lib/i18n/context';

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

// A deterministic soft gradient per name, so avatar fallbacks feel designed
// rather than a flat grey block.
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 72% 45%))`;
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
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-black/10" />
      ) : (
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl text-base font-bold text-white ring-1 ring-white/10"
          style={{ backgroundImage: avatarGradient(name || '?') }}
        >
          {initial}
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
  const [err, setErr] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [, setUnreadCount] = useState(0);
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
    const load = () => {
      listChats()
        .then(setChats)
        .catch((e) => setErr(e?.message ?? String(e)));
      // Acknowledge delivery of any incoming messages while the app is open,
      // even for chats the user hasn't opened yet (RLS scopes this to my chats).
      void markIncomingDelivered().catch(() => {});
    };
    load();

    if (loading || !user || !profile) return;

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
              load();
            }
            return;
          }
          if (profile.role === 'admin') {
            if (newRow.store_id === profile.store_id) load();
            return;
          }
          load();
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        load();
      })
      .subscribe();

    return () => {
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
              <div className="relative">
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
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="toky-glass toky-elev absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-slate-800 py-1.5">
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

            {loading ? (
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
            ) : (
              <ul className="space-y-0.5">
                {chats
                  .filter((c) => (c.title || '').toLowerCase().includes(search.trim().toLowerCase()))
                  .map((c, i) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id} className="toky-rise" style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
                      <button
                        onClick={() => openChat(c.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${
                          active ? 'bg-slate-800/80 shadow-sm' : 'hover:bg-slate-900/70 active:bg-slate-900'
                        }`}
                      >
                        <ChatAvatar chat={c} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate font-semibold">
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
                            <div className="shrink-0 text-xs font-medium text-slate-500">{fmt(c.last_message_at, lang)}</div>
                          </div>
                          <div className="mt-0.5 truncate text-[13px] text-slate-400">{preview(c)}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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

      <BottomNav />
    </div>
  );
}
