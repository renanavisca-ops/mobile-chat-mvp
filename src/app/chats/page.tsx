'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listChats } from '@/lib/db/chats';
import type { ChatSummary } from '@/lib/db/types';

function fmt(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function ChatsPage() {
  const { loading } = useRequireAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (loading) return;
    listChats()
      .then(setChats)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [loading]);

  return (
    <PageShell title="Chats" right={<Link className="text-sm text-slate-200 hover:text-white" href="/contacts">New chat</Link>}>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}

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
                    {c.kind === 'group' ? c.title ?? 'Group' : 'Direct chat'}
                  </div>
                  <div className="text-xs text-slate-500">{fmt(c.last_message_at)}</div>
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {c.last_ciphertext ? '…new message' : 'No messages yet'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
