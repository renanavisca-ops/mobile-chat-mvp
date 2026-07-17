'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

import { BottomNav } from '@/components/page-shell';
import { StoriesBar } from '@/components/stories-bar';
import { ChatConversation } from '@/components/chat-conversation';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { browserSupabase } from '@/lib/supabase/client';
import { listChats } from '@/lib/db/chats';
import { useIsOnline } from '@/components/presence-provider';
import { useLanguage, useT } from '@/lib/i18n/context';

import type { ChatSummary } from '@/lib/db/types';

function fmt(ts: string | null, locale: string) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString(locale);
}

function OnlineDot({ userId }: { userId: string | null | undefined }) {
  const online = useIsOnline(userId);
  const t = useT();
  if (!userId || !online) return null;
  return (
    <span
      className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle"
      title={t('chatsList.online')}
    />
  );
}

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-full border border-slate-800 object-cover" />;
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-semibold text-slate-300">
      {initial}
    </span>
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
  const [, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
  }, []);

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
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1">
        {/* LEFT — conversation list */}
        <aside className="flex min-h-0 w-full flex-col lg:w-96 lg:shrink-0 lg:border-r lg:border-slate-900">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-900 bg-slate-950/90 px-4 py-3 pt-safe backdrop-blur">
            <h1 className="text-lg font-semibold">{t('chatsList.title')}</h1>
            <Link className="text-sm text-blue-400 hover:text-blue-300" href="/contacts">
              {t('chatsList.newChat')}
            </Link>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-3 lg:pb-4">
            <StoriesBar />

            {err ? <p className="text-sm text-red-300">{err}</p> : null}

            {loading ? (
              <p className="text-sm text-slate-300">{t('chatsList.loading')}</p>
            ) : chats.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-300">{t('chatsList.noChatsYet')}</p>
                <Link className="inline-block rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" href="/contacts">
                  {t('chatsList.goToContacts')}
                </Link>
              </div>
            ) : (
              <ul className="space-y-1">
                {chats.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => openChat(c.id)}
                        className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                          active ? 'bg-slate-900' : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <Avatar url={c.kind === 'direct' ? c.other_user_avatar : c.avatar_url} name={c.title} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate font-medium">
                              {c.kind === 'group' ? c.title ?? t('chatsList.group') : c.title ?? t('chatsList.directChat')}
                              {c.kind === 'direct' && <OnlineDot userId={c.other_user_id} />}
                              {c.store_id && c.status && (
                                <span
                                  className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                                    c.status === 'open'
                                      ? 'bg-green-900/40 text-green-400'
                                      : c.status === 'in_progress'
                                      ? 'bg-blue-900/40 text-blue-400'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {statusLabel(c.status)}
                                </span>
                              )}
                            </div>
                            <div className="shrink-0 text-xs text-slate-500">{fmt(c.last_message_at, lang)}</div>
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-400">{preview(c)}</div>
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
