'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { addContact, listMyContacts, searchUsers } from '@/lib/db/contacts';
import { createDirectChatWith } from '@/lib/db/chats';
import type { ProfileLite } from '@/lib/db/types';

export default function ContactsPage() {
  const { loading } = useRequireAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [err, setErr] = useState('');

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    if (loading) return;
    listMyContacts()
      .then(setContacts)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [loading]);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      return;
    }
    searchUsers(q)
      .then(setResults)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [q, canSearch]);

  async function onAdd(id: string) {
    setErr('');
    try {
      await addContact(id);
      const list = await listMyContacts();
      setContacts(list);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function onChat(id: string) {
    setErr('');
    try {
      const chatId = await createDirectChatWith(id);
      window.location.href = `/chats/${chatId}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <PageShell title="Contacts" right={<Link className="text-sm text-slate-200 hover:text-white" href="/groups/new">New group</Link>}>
      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
          <div className="text-sm text-slate-300">Search users by username</div>
          <input
            className="mt-2 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="type at least 2 chars…"
          />
          <div className="mt-2 text-xs text-slate-500">Tip: each user should set username in /onboarding</div>

          {results.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-900 rounded-lg border border-slate-900">
              {results.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-2">
                  <div className="text-sm">{r.username ?? r.id}</div>
                  <div className="flex gap-2">
                    <button className="rounded bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => onAdd(r.id)}>
                      Add
                    </button>
                    <button className="rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500" onClick={() => onChat(r.id)}>
                      Chat
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : canSearch ? (
            <p className="mt-3 text-sm text-slate-400">No results.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
          <div className="text-sm text-slate-300">My contacts</div>
          {contacts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No contacts yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-900 rounded-lg border border-slate-900">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 p-2">
                  <div className="text-sm">{c.username ?? c.id}</div>
                  <button className="rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500" onClick={() => onChat(c.id)}>
                    Chat
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
