'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { browserSupabase } from '@/lib/supabase/client';
import { createDirectChatWith } from '@/lib/db/chats';
import { addContact, listMyContacts, searchUsers } from '@/lib/db/contacts';
import type { ProfileLite } from '@/lib/db/types';

export default function ContactsPage() {
  const { loading } = useRequireAuth();
  const supabase = browserSupabase();

  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [err, setErr] = useState('');

  // modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  async function refreshContacts() {
    const list = await listMyContacts();
    setContacts(list);
  }

  useEffect(() => {
    if (loading) return;
    refreshContacts().catch((e) => setErr(e?.message ?? String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (!openAdd) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [openAdd]);

  useEffect(() => {
    if (!openAdd) return;

    if (!canSearch) {
      setResults([]);
      return;
    }

    searchUsers(q)
      .then(setResults)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [q, canSearch, openAdd]);

  function openModal() {
    setErr('');
    setQ('');
    setResults([]);
    setOpenAdd(true);
  }

  function closeModal() {
    setOpenAdd(false);
    setQ('');
    setResults([]);
  }

  async function onAdd(userId: string) {
    setErr('');
    try {
      await addContact(userId);
      await refreshContacts();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function onChat(userId: string) {
    setErr('');
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Not authenticated');

      const chatId = await createDirectChatWith(userId);
      window.location.href = `/chats/${chatId}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <PageShell
      title="Contacts"
      right={
        <button
          className="rounded-full bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500"
          onClick={openModal}
        >
          + Add contact
        </button>
      }
    >
      {err ? <p className="mb-3 text-sm text-red-300">{err}</p> : null}

      <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
        <div className="text-sm text-slate-300">My contacts</div>

        {contacts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No contacts yet. Click “Add contact”.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-900 rounded-lg border border-slate-900">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-2">
                <div className="text-sm">{c.username ?? c.id}</div>
                <button
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500"
                  onClick={() => onChat(c.id)}
                >
                  Chat
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add contact modal */}
      {openAdd ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Add contact</div>
                <div className="text-xs text-slate-400">
                  Search by <b>username</b> (set in <b>/onboarding</b>). Min 2 chars.
                </div>
              </div>
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
                onClick={closeModal}
              >
                Close
              </button>
            </div>

            <input
              ref={inputRef}
              className="mt-3 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. ana, jose, tienda01…"
            />

            {canSearch ? (
              results.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-900 rounded-lg border border-slate-900">
                  {results.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 p-2">
                      <div className="text-sm">{r.username ?? r.id}</div>
                      <div className="flex gap-2">
                        <button
                          className="rounded bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
                          onClick={() => onAdd(r.id)}
                        >
                          Add
                        </button>
                        <button
                          className="rounded bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500"
                          onClick={() => onChat(r.id)}
                        >
                          Chat
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">No results.</p>
              )
            ) : (
              <p className="mt-3 text-sm text-slate-500">Type at least 2 characters…</p>
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
