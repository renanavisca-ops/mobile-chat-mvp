'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { getStoreStats, type StoreStats } from '@/lib/db/stats';

function Tile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
      <div className={`text-2xl font-semibold ${accent ?? 'text-slate-100'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

/**
 * Settings card with support stats (attention/volume) for a store. Only
 * rendered for store admins; the RPC also enforces that.
 */
export function StatsSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = browserSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) { if (alive) setLoading(false); return; }
        const { data } = await (supabase as any)
          .from('profiles').select('role, store_id').eq('id', user.id).limit(1);
        const prof = (data as any[])?.[0];
        const canView = prof && prof.store_id && (prof.role === 'admin' || prof.role === 'superadmin');
        if (!canView) { if (alive) setLoading(false); return; }
        const s = await getStoreStats(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setStats(s);
      } catch {
        if (alive) setStatus(`❌ ${t('stats.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId || !stats) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('stats.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('stats.desc')}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile label={t('stats.open')} value={stats.chatsOpen} accent="text-green-400" />
        <Tile label={t('stats.inProgress')} value={stats.chatsInProgress} accent="text-blue-400" />
        <Tile label={t('stats.closed')} value={stats.chatsClosed} accent="text-slate-300" />
        <Tile label={t('stats.customers')} value={stats.customers} />
        <Tile label={t('stats.unread')} value={stats.unreadCustomer} accent={stats.unreadCustomer > 0 ? 'text-amber-400' : 'text-slate-100'} />
        <Tile label={t('stats.total')} value={stats.chatsTotal} />
      </div>

      <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
        <div className="mb-2 text-xs font-medium text-slate-300">{t('stats.messages7d')}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-lg font-semibold text-slate-100">{stats.msgs7dTotal}</div><div className="text-[11px] text-slate-400">{t('stats.msgsTotal')}</div></div>
          <div><div className="text-lg font-semibold text-slate-100">{stats.msgs7dCustomer}</div><div className="text-[11px] text-slate-400">{t('stats.msgsCustomer')}</div></div>
          <div><div className="text-lg font-semibold text-slate-100">{stats.msgs7dStaff}</div><div className="text-[11px] text-slate-400">{t('stats.msgsStaff')}</div></div>
        </div>
      </div>

      {stats.byAgent.length > 0 && (
        <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
          <div className="mb-2 text-xs font-medium text-slate-300">{t('stats.byAgent')}</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
              <span className="min-w-0 flex-1">{t('stats.agent')}</span>
              <span className="w-16 text-right">{t('stats.active')}</span>
              <span className="w-16 text-right">{t('stats.closedShort')}</span>
            </div>
            {stats.byAgent.map((a) => (
              <div key={a.agentId} className="flex items-center gap-2 px-1 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-200">{a.name}</span>
                <span className="w-16 text-right text-slate-300">{a.active}</span>
                <span className="w-16 text-right text-slate-400">{a.closed}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {status && <p className="px-1 text-xs text-slate-400">{status}</p>}
    </div>
  );
}
