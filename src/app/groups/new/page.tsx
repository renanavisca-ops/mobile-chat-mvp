'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listMyContacts, searchUsers } from '@/lib/db/contacts';
import { createGroupChat } from '@/lib/db/chats';
import type { ProfileLite } from '@/lib/db/types';

export default function NewGroupPage() {
  const { loading: authLoading } = useRequireAuth();

  const [title, setTitle] = useState('');
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  // selected members: id -> username (so chips render without another lookup)
  const [selected, setSelected] = useState<Map<string, string | null>>(new Map());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  // Load contacts as convenient quick-picks (optional — search covers everyone).
  useEffect(() => {
    if (authLoading) return;
    listMyContacts()
      .then(setContacts)
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [authLoading]);

  // Live search over all users (not just contacts).
  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(q)
        .then(setResults)
        .catch((e) => setErr(e?.message ?? String(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [q, canSearch]);

  function toggle(user: ProfileLite) {
    setSelected((prev) => {
      const copy = new Map(prev);
      if (copy.has(user.id)) copy.delete(user.id);
      else copy.set(user.id, user.username);
      return copy;
    });
  }

  async function onCreate() {
    setErr('');
    const trimmed = title.trim();
    if (!trimmed) {
      setErr('Group name required');
      return;
    }
    if (selected.size === 0) {
      setErr('Select at least 1 member');
      return;
    }

    setBusy(true);
    try {
      const chatId = await createGroupChat(trimmed, Array.from(selected.keys()));
      window.location.href = `/chats/${chatId}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // Rows to show: search results when searching, otherwise contacts.
  const rows = canSearch ? results : contacts;

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

        {/* Selected chips */}
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(selected.entries()).map(([id, username]) => (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 px-3 py-1 text-sm text-blue-200"
              >
                {username ?? id.slice(0, 8)}
                <button
                  className="text-blue-300 hover:text-white"
                  onClick={() => toggle({ id, username })}
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search members */}
        <div>
          <div className="text-sm text-slate-300 mb-2">Add members</div>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username (min 2 chars)…"
            autoCapitalize="none"
          />

          <ul className="mt-2 space-y-2">
            {rows.length === 0 ? (
              <li className="text-sm text-slate-500">
                {canSearch ? 'No users found.' : 'Type a username above to find people to add.'}
              </li>
            ) : (
              rows.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded border border-slate-900 bg-slate-950/60 p-2"
                >
                  <span className="text-sm">{c.username ?? c.id}</span>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c)}
                  />
                </li>
              ))
            )}
          </ul>
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
