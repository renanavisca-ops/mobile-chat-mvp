'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { listPublicChannels, createChannel, joinChannel, type ChannelSummary } from '@/lib/db/chats';
import { EmptyState } from '@/components/empty-state';
import { HashIcon, PlusIcon } from '@/components/icons';
import { useT } from '@/lib/i18n/context';

export default function ChannelsPage() {
  const { loading: authLoading } = useRequireAuth();
  const t = useT();

  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  function load(search?: string) {
    setLoading(true);
    listPublicChannels(search)
      .then(setChannels)
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    const timer = setTimeout(() => load(q), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function onJoin(c: ChannelSummary) {
    setBusyId(c.id);
    setErr('');
    try {
      await joinChannel(c.id);
      window.location.href = `/chats/${c.id}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusyId(null);
    }
  }

  async function onCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setErr('');
    try {
      const id = await createChannel(title, newDesc.trim() || undefined);
      window.location.href = `/chats/${id}`;
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setCreating(false);
    }
  }

  return (
    <PageShell title={t('channels.title')}>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('channels.searchPlaceholder')}
            autoCapitalize="none"
          />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="toky-grad toky-ring-brand rounded-xl px-3 py-2 text-sm font-semibold text-white"
          >
            {t('channels.create')}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">{t('common.loading')}</p>
        ) : channels.length === 0 ? (
          <EmptyState
            icon={<HashIcon size={28} />}
            title={t('channels.empty')}
            action={{ label: t('channels.create'), onClick: () => setCreateOpen(true), icon: <PlusIcon size={18} /> }}
          />
        ) : (
          <ul className="space-y-2">
            {channels.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/60 p-3"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-800 text-lg font-semibold text-slate-300">
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (c.title || '#').trim().charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-100">{c.title || t('channels.untitled')}</div>
                  {c.description ? (
                    <div className="truncate text-xs text-slate-400">{c.description}</div>
                  ) : null}
                </div>
                {c.joined ? (
                  <a
                    href={`/chats/${c.id}`}
                    className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    {t('channels.open')}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onJoin(c)}
                    disabled={busyId === c.id}
                    className="shrink-0 toky-grad toky-ring-brand rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busyId === c.id ? t('channels.joining') : t('channels.join')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !creating) setCreateOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
            <div className="text-base font-semibold text-slate-100">{t('channels.createTitle')}</div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={60}
              placeholder={t('channels.namePlaceholder')}
              className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder={t('channels.descPlaceholder')}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <p className="mt-2 text-xs text-slate-500">{t('channels.createNote')}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={creating || !newTitle.trim()}
                className="flex-1 toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? t('channels.creating') : t('channels.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
