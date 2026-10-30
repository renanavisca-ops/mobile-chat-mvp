'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { useRequireAuth } from '@/lib/auth/use-require-auth';
import { EmptyState } from '@/components/empty-state';
import { ChatListSkeleton } from '@/components/skeleton';
import { UsersIcon, PlusIcon } from '@/components/icons';
import { useT } from '@/lib/i18n/context';
import {
  listMyCommunities, createCommunity, deleteCommunity,
  getCommunityGroups, addGroupToCommunity, removeGroupFromCommunity, listMyAdminGroups,
  type Community, type CommunityGroup, type AdminGroup,
} from '@/lib/db/communities';

type View = { mode: 'index' } | { mode: 'detail'; community: Community };

export default function CommunitiesPage() {
  const { loading: authLoading } = useRequireAuth();
  const t = useT();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<View>({ mode: 'index' });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    listMyCommunities().then(setCommunities).catch((e) => setErr(e?.message ?? String(e))).finally(() => setLoading(false));
  }

  useEffect(() => { if (!authLoading) load(); /* eslint-disable-next-line */ }, [authLoading]);

  async function onCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setErr('');
    try {
      await createCommunity(name, newDesc.trim() || undefined);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setCreating(false);
    }
  }

  if (view.mode === 'detail') {
    return <CommunityDetail community={view.community} onBack={() => { setView({ mode: 'index' }); load(); }} />;
  }

  return (
    <PageShell title={t('communities.title')}>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
      <p className="mb-4 text-sm text-slate-400">{t('communities.explainer')}</p>

      <button
        className="mb-4 w-full rounded-xl toky-grad toky-ring-brand px-4 py-2.5 text-sm font-semibold text-white"
        onClick={() => setCreateOpen(true)}
      >
        + {t('communities.create')}
      </button>

      {loading ? (
        <ChatListSkeleton rows={5} />
      ) : communities.length === 0 ? (
        <EmptyState icon={<UsersIcon size={28} />} title={t('communities.empty')} action={{ label: t('communities.create'), onClick: () => setCreateOpen(true), icon: <PlusIcon size={18} /> }} />
      ) : (
        <ul className="space-y-2">
          {communities.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setView({ mode: 'detail', community: c })}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/60 p-3 text-left hover:bg-slate-900/60"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-800 text-lg font-semibold text-slate-300">
                  {(c.name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">{c.name}</span>
                  {c.description ? <span className="block truncate text-xs text-slate-400">{c.description}</span> : null}
                </span>
                {c.isOwner && <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{t('communities.owner')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) setCreateOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
            <div className="text-base font-semibold text-slate-100">{t('communities.createTitle')}</div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder={t('communities.namePlaceholder')}
              className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={300} rows={2} placeholder={t('communities.descPlaceholder')}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setCreateOpen(false)} disabled={creating} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">{t('common.cancel')}</button>
              <button onClick={onCreate} disabled={creating || !newName.trim()} className="flex-1 toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creating ? t('communities.creating') : t('communities.create')}</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function CommunityDetail({ community, onBack }: { community: Community; onBack: () => void }) {
  const t = useT();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  function load() {
    setLoading(true);
    Promise.all([getCommunityGroups(community.id), community.isOwner ? listMyAdminGroups() : Promise.resolve([])])
      .then(([g, a]) => { setGroups(g); setAdminGroups(a); })
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [community.id]);

  const linkedIds = new Set(groups.map((g) => g.chatId));
  const addable = adminGroups.filter((g) => !linkedIds.has(g.chatId));

  async function add(chatId: string) {
    setBusy(chatId); setErr('');
    try { await addGroupToCommunity(community.id, chatId); load(); }
    catch (e: any) { setErr(e?.message ?? String(e)); setBusy(null); }
  }
  async function remove(chatId: string) {
    setBusy(chatId); setErr('');
    try { await removeGroupFromCommunity(community.id, chatId); load(); }
    catch (e: any) { setErr(e?.message ?? String(e)); setBusy(null); }
  }
  async function onDelete() {
    if (!window.confirm(t('communities.deleteConfirm'))) return;
    try { await deleteCommunity(community.id); onBack(); } catch (e: any) { setErr(e?.message ?? String(e)); }
  }

  return (
    <PageShell title={community.name}>
      <button className="mb-3 text-sm text-blue-400 hover:text-blue-300" onClick={onBack}>← {t('communities.back')}</button>
      {community.description ? <p className="mb-3 text-sm text-slate-400">{community.description}</p> : null}
      {err && <p className="mb-2 text-sm text-red-400">{err}</p>}

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('communities.groups')}</div>
      {loading ? (
        <ChatListSkeleton rows={3} />
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-slate-900 bg-slate-950/40 p-3 text-sm text-slate-500">{t('communities.noGroups')}</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.chatId} className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/60 p-3">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{g.title || t('chatsList.group')}</span>
              <Link href={`/chats/view?c=${g.chatId}`} className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">{t('channels.open')}</Link>
              {community.isOwner && (
                <button onClick={() => remove(g.chatId)} disabled={busy === g.chatId} className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-rose-300 hover:bg-slate-800 disabled:opacity-50">{t('communities.removeGroup')}</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {community.isOwner && (
        <>
          <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('communities.addGroup')}</div>
          {addable.length === 0 ? (
            <p className="rounded-xl border border-slate-900 bg-slate-950/40 p-3 text-sm text-slate-500">{t('communities.noAddable')}</p>
          ) : (
            <ul className="space-y-2">
              {addable.map((g) => (
                <li key={g.chatId} className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/60 p-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{g.title || t('chatsList.group')}</span>
                  <button onClick={() => add(g.chatId)} disabled={busy === g.chatId} className="shrink-0 toky-grad toky-ring-brand rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{t('communities.add')}</button>
                </li>
              ))}
            </ul>
          )}

          <button onClick={onDelete} className="mt-6 w-full rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-950/50">{t('communities.deleteCommunity')}</button>
        </>
      )}
    </PageShell>
  );
}
