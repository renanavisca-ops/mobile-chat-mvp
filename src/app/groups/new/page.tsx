'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listMyContacts } from '@/lib/db/contacts';
import { createGroupChat } from '@/lib/db/chats';
import type { ProfileLite } from '@/lib/db/types';

export default function NewGroupPage() {
  const { loading } = useRequireAuth();
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    listMyContacts()
      .then(setContacts)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [loading]);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function create() {
    setBusy(true);
    setErr('');
    try {
      const ids = Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (!title.trim()) throw new Error('Group title is required');
      if (ids.length === 0) throw new Error('Select at least 1 contact');
      const chatId = await createGroupChat(title.trim(), ids);
      window.location.href = `/chats/${chatId}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="New group">
      {err ? <p className="text-sm text-red-300">{err}</p> : null}

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-300">Group title</label>
          <input
            className="mt-1 w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Store #3 team"
          />
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
          <div className="text-sm text-slate-300">Select members</div>
          {contacts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No contacts yet. Add some in /contacts.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-900 p-2">
                  <div className="text-sm">{c.username ?? c.id}</div>
                  <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggle(c.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          onClick={create}
          disabled={busy}
        >
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </PageShell>
  );
}
