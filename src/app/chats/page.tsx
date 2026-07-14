'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

import { PageShell } from '@/components/page-shell';
import { StoriesBar } from '@/components/stories-bar';
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
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-slate-800 object-cover" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-semibold text-slate-300">
      {initial}
    </span>
  );
}

export default function ChatsPage() {
  const { loading, profile, user } = useRequireAuth();
  const { t, lang } = useLanguage();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [err, setErr] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
  }, []);

  useEffect(() => {
    // Initial load — always attempt, even if session is still loading
    // (listChats() internally gets user from supabase.auth and returns [] if none)
    const load = () => {
      listChats()
        .then(setChats)
        .catch((e) => setErr(e?.message ?? String(e)));
    };

    // If still loading session, try once anyway (may return [])
    // When loading finishes, this effect re-runs with user/profile populated
    load();

    // Don't set up realtime channels until we have the user info
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

          // Only notify when a chat is created
          if (payload.eventType !== 'INSERT') return;

          // 1. Agent logic
          if (profile.role === 'agent') {
            if (newRow.assigned_to === user.id) {
              setUnreadCount(prev => prev + 1);
              audioRef.current?.play().catch(() => {});
              load();
            }
            return;
          }

          // 2. Admin logic
          if (profile.role === 'admin') {
            if (newRow.store_id === profile.store_id) {
              load();
            }
            return;
          }

          // 3. Superadmin
          load();
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      void browserSupabase().removeChannel(channel);
      void browserSupabase().removeChannel(messagesChannel);
    };
  }, [loading, user, profile]);

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
      case 'deleted':
        return t('chatsList.deletedMessage');
      default:
        return t('chatsList.noMessagesYet');
    }
  }

  return (
    <PageShell title={t('chatsList.title')} right={<Link className="text-sm text-slate-200 hover:text-white" href="/contacts">{t('chatsList.newChat')}</Link>}>
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
        <ul className="divide-y divide-slate-900">
          {chats.map((c) => (
            <li key={c.id} className="py-3">
              <Link href={`/chats/${c.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-950/60">
                <Avatar url={c.kind === 'direct' ? c.other_user_avatar : c.avatar_url} name={c.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate font-medium">
                      {c.kind === 'group' ? c.title ?? t('chatsList.group') : c.title ?? t('chatsList.directChat')}
                      {c.kind === 'direct' && <OnlineDot userId={c.other_user_id} />}
                      {c.store_id && c.status && (
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          c.status === 'open' ? 'bg-green-900/40 text-green-400' :
                          c.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {statusLabel(c.status)}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 text-xs text-slate-500">{fmt(c.last_message_at, lang)}</div>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">
                    {preview(c)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
