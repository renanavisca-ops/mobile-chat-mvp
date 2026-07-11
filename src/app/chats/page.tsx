'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { browserSupabase } from '@/lib/supabase/client';
import { listChats } from '@/lib/db/chats';

import type { ChatSummary } from '@/lib/db/types';

function fmt(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}

function chatTitle(chat: ChatSummary) {
  if (chat.kind === 'group') return chat.title ?? 'Group';
  if (chat.kind === 'customer') return chat.title ?? 'Customer chat';
  return chat.title ?? 'Direct chat';
}

export default function ChatsPage() {
  const { loading, profile, user } = useRequireAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [err, setErr] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
  }, []);

  useEffect(() => {
    if (loading || !user?.id || !profile) return;

    const load = () => {
      listChats(user.id, profile as any)
        .then(setChats)
        .catch((e) => setErr(e?.message ?? String(e)));
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

          if (payload.eventType === 'INSERT' && newRow.assigned_to === user.id) {
            setUnreadCount((prev) => prev + 1);
            audioRef.current?.play().catch(() => {});
          }

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
      void supabase.removeChannel(channel);
      void supabase.removeChannel(messagesChannel);
    };
  }, [loading, user?.id, profile]);

  return (
    <PageShell title="Chats" right={<Link className="text-sm text-slate-200 hover:text-white" href="/contacts">New chat</Link>}>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}
      {unreadCount > 0 ? <p className="mb-2 text-xs text-blue-300">Nuevos chats/mensajes: {unreadCount}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : chats.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">No chats yet.</p>
          <Link className="inline-block rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" href="/contacts">
            Go to Contacts
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-900">
          {chats.map((c) => (
            <li key={c.id} className="py-3">
              <Link href={`/chats/${c.id}`} className="block rounded-lg p-2 hover:bg-slate-950/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {chatTitle(c)}
                    {c.status && (
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                        c.status === 'open' ? 'bg-green-900/40 text-green-400' :
                        c.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {c.status}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">{fmt(c.last_message_at)}</div>
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {c.last_ciphertext ? c.last_ciphertext : 'No messages yet'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
