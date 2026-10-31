'use client';

import { useEffect, useState } from 'react';
import { useT, useFormatters } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { getAuditLog, type AuditEntry } from '@/lib/db/audit';

/**
 * Settings card showing a store's recent audit entries (role changes, chat
 * assignment/status). Only rendered for store admins; the RLS also enforces it.
 */
export function AuditLogSettings() {
  const t = useT();
  const fmts = useFormatters();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
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
        const log = await getAuditLog(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setEntries(log);
      } catch {
        if (alive) setStatus(`❌ ${t('audit.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  function describe(e: AuditEntry): string {
    const actor = e.actorName || '—';
    const d = e.detail || {};
    if (e.action === 'role_change') {
      return t('audit.roleChange', { actor, target: e.targetName || '—', from: String(d.from ?? '—'), to: String(d.to ?? '—') });
    }
    if (e.action === 'chat_assigned') {
      return d.assigned_to ? t('audit.chatAssigned', { actor }) : t('audit.chatUnassigned', { actor });
    }
    if (e.action === 'chat_status') {
      return t('audit.chatStatus', { actor, status: String(d.status ?? '—') });
    }
    return `${actor}: ${e.action}`;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('audit.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('audit.desc')}</div>
      </div>

      {entries.length === 0 ? (
        <p className="px-1 text-xs text-slate-500">{t('audit.empty')}</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-slate-900 bg-slate-950/40 p-3">
              <div className="text-sm text-slate-200">{describe(e)}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{fmts.relative(e.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
      {status && <p className="px-1 text-xs text-slate-400">{status}</p>}
    </div>
  );
}
