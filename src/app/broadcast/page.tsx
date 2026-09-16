'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listMyContacts, searchUsers } from '@/lib/db/contacts';
import { createDirectChatWith, sendMessage } from '@/lib/db/chats';
import {
  listBroadcastLists,
  createBroadcastList,
  deleteBroadcastList,
  type BroadcastList,
} from '@/lib/broadcast-lists';
import { useT } from '@/lib/i18n/context';
import type { ProfileLite } from '@/lib/db/types';

type View = { mode: 'index' } | { mode: 'create' } | { mode: 'send'; list: BroadcastList };

export default function BroadcastPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const t = useT();
  const ownerId = user?.id ?? '';

  const [lists, setLists] = useState<BroadcastList[]>([]);
  const [view, setView] = useState<View>({ mode: 'index' });

  const refresh = () => setLists(listBroadcastLists(ownerId));

  useEffect(() => {
    if (!authLoading && ownerId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, ownerId]);

  if (view.mode === 'create') {
    return (
      <CreateList
        onCancel={() => setView({ mode: 'index' })}
        onCreate={(name, members) => {
          createBroadcastList(ownerId, name, members.map((m) => ({ id: m.id, username: m.username })));
          refresh();
          setView({ mode: 'index' });
        }}
      />
    );
  }

  if (view.mode === 'send') {
    return <SendToList list={view.list} onBack={() => setView({ mode: 'index' })} />;
  }

  return (
    <PageShell title={t('broadcast.title')}>
      <p className="mb-4 text-sm text-slate-400">{t('broadcast.explainer')}</p>

      <button
        className="mb-4 w-full rounded-xl toky-grad toky-ring-brand px-4 py-2.5 text-sm font-semibold text-white"
        onClick={() => setView({ mode: 'create' })}
      >
        + {t('broadcast.newList')}
      </button>

      {lists.length === 0 ? (
        <p className="rounded-xl border border-slate-900 bg-slate-950/40 p-4 text-sm text-slate-500">
          {t('broadcast.noLists')}
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/60 p-3"
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => setView({ mode: 'send', list: l })}>
                <div className="truncate text-sm font-semibold text-slate-100">{l.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {t('broadcast.recipients').replace('{n}', String(l.members.length))}
                </div>
              </button>
              <button
                className="rounded-lg px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
                onClick={() => {
                  if (window.confirm(t('broadcast.deleteConfirm'))) {
                    deleteBroadcastList(ownerId, l.id);
                    refresh();
                  }
                }}
              >
                {t('broadcast.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

/** Create a broadcast list: name + recipient picker (same pattern as New Group). */
function CreateList({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string, members: ProfileLite[]) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [selected, setSelected] = useState<Map<string, ProfileLite>>(new Map());
  const [err, setErr] = useState('');

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    listMyContacts().then(setContacts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchUsers(q).then(setResults).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [q, canSearch]);

  function toggle(u: ProfileLite) {
    setSelected((prev) => {
      const copy = new Map(prev);
      if (copy.has(u.id)) copy.delete(u.id);
      else copy.set(u.id, u);
      return copy;
    });
  }

  const rows = canSearch ? results : contacts;

  return (
    <PageShell title={t('broadcast.newList')}>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">{t('broadcast.name')}</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('broadcast.namePlaceholder')}
          />
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(selected.values()).map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-2 rounded-full bg-blue-900/40 px-3 py-1 text-sm text-blue-200"
              >
                {u.username ?? u.id.slice(0, 8)}
                <button className="text-blue-300 hover:text-white" onClick={() => toggle(u)} aria-label="×">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div>
          <div className="mb-2 text-sm text-slate-300">
            {t('broadcast.addMembers')}{' '}
            <span className="text-slate-500">({selected.size})</span>
          </div>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('broadcast.searchPlaceholder')}
            autoCapitalize="none"
          />
          <ul className="mt-2 space-y-2">
            {rows.length === 0 ? (
              <li className="text-sm text-slate-500">
                {canSearch ? t('groupNew.noUsersFound') : t('groupNew.typeToSearch')}
              </li>
            ) : (
              rows.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded border border-slate-900 bg-slate-950/60 p-2"
                >
                  <span className="text-sm">{c.username ?? c.id}</span>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c)} />
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 rounded border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            className="flex-1 rounded toky-grad toky-ring-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => {
              setErr('');
              if (!name.trim()) return setErr(t('broadcast.emptyName'));
              if (selected.size === 0) return setErr(t('broadcast.emptyMembers'));
              onCreate(name, Array.from(selected.values()));
            }}
          >
            {t('broadcast.create')}
          </button>
        </div>
      </div>
    </PageShell>
  );
}

/** Compose a message and fan it out to every member's 1:1 chat. */
function SendToList({ list, onBack }: { list: BroadcastList; onBack: () => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ ok: number; failed: number } | null>(null);
  const [err, setErr] = useState('');

  async function send() {
    const body = text.trim();
    if (!body) return;
    setErr('');
    setBusy(true);
    setDone(null);
    setProgress(0);
    let ok = 0;
    let failed = 0;
    for (const m of list.members) {
      try {
        const chatId = await createDirectChatWith(m.id);
        await sendMessage(chatId, { text: body });
        ok += 1;
      } catch {
        failed += 1;
      }
      setProgress((p) => p + 1);
    }
    setBusy(false);
    setDone({ ok, failed });
    if (ok > 0) setText('');
  }

  return (
    <PageShell title={list.name}>
      <button className="mb-3 text-sm text-blue-400 hover:text-blue-300" onClick={onBack}>
        ← {t('broadcast.back')}
      </button>

      <p className="mb-2 text-xs text-slate-500">
        {t('broadcast.recipients').replace('{n}', String(list.members.length))} · {t('broadcast.explainer')}
      </p>

      {err && <p className="mb-2 text-sm text-red-400">{err}</p>}

      {done && (
        <p className="mb-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          {t('broadcast.sentSummary')
            .replace('{ok}', String(done.ok))
            .replace('{total}', String(list.members.length))}
          {done.failed > 0 ? ` · ${t('broadcast.failedCount').replace('{n}', String(done.failed))}` : ''}
        </p>
      )}

      <textarea
        className="min-h-28 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('broadcast.messagePlaceholder')}
        disabled={busy}
      />

      <button
        className="mt-3 w-full rounded-xl toky-grad toky-ring-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        onClick={send}
        disabled={busy || !text.trim()}
      >
        {busy
          ? `${t('broadcast.sending')} (${progress}/${list.members.length})`
          : t('broadcast.send')}
      </button>
    </PageShell>
  );
}
