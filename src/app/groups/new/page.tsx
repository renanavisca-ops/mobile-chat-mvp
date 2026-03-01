'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listMyContacts } from '@/lib/db/contacts';
import { createGroupChat } from '@/lib/db/chats';
import type { ProfileLite } from '@/lib/db/types';

export default function NewGroupPage() {
  const { loading: authLoading } = useRequireAuth();

  const [title, setTitle] = useState('');
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (authLoading) return;
    listMyContacts()
      .then(setContacts)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [authLoading]);

  function toggle(id: string) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  async function onCreate() {
    setErr('');

    const trimmed = title.trim();
    if (!trimmed) {
      setErr('Group title required');
      return;
    }

    if (selected.size === 0) {
      setErr('Select at least 1 contact');
      return;
    }

    setBusy(true);

    try {
      const chatId = await createGroupChat(trimmed, Array.from(selected));
      window.location.href = `/chats/${chatId}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="New Group">
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      <div className="flex flex-col gap-4">

        {/* Title */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Group name</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Marketing Team"
          />
        </div>

        {/* Contacts */}
        <div>
          <div className="text-sm text-slate-300 mb-2">Select members</div>

          {contacts.length === 0 ? (
            <p className="text-sm text-slate-400">
              You have no contacts. Add contacts first.
            </p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded border border-slate-900 bg-slate-950/60 p-2"
                >
                  <span className="text-sm">
                    {c.username ?? c.id}
                  </span>

                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Button */}
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          onClick={onCreate}
          disabled={busy}
        >
          {busy ? 'Creating…' : 'Create group'}
        </button>

      </div>
    </PageShell>
  );
}
