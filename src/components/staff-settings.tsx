'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { listStoreStaff, setMemberRole, type StaffMember } from '@/lib/db/staff';

/**
 * Settings card to view a store's staff and change roles (agent ↔ admin).
 * Only rendered for store admins; superadmins are shown read-only.
 */
export function StaffSettings() {
  const t = useT();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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
        const canManage = prof && prof.store_id && (prof.role === 'admin' || prof.role === 'superadmin');
        if (!canManage) { if (alive) setLoading(false); return; }
        const list = await listStoreStaff(prof.store_id);
        if (!alive) return;
        setStoreId(prof.store_id);
        setMeId(user.id);
        setStaff(list);
      } catch {
        if (alive) setStatus(`❌ ${t('staff.loadError')}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  if (loading || !storeId) return null;

  async function changeRole(m: StaffMember, role: 'agent' | 'admin') {
    if (role === m.role) return;
    setBusyId(m.id);
    setStatus('');
    try {
      await setMemberRole(m.id, role);
      setStaff((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
      setStatus(`✅ ${t('staff.saved')}`);
    } catch {
      setStatus(`❌ ${t('staff.saveError')}`);
    } finally {
      setBusyId(null);
    }
  }

  const roleLabel = (r: string) =>
    r === 'superadmin' ? t('staff.roleSuperadmin') : r === 'admin' ? t('staff.roleAdmin') : t('staff.roleAgent');

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('staff.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('staff.desc')}</div>
      </div>

      <div className="space-y-2">
        {staff.map((m) => {
          const locked = m.role === 'superadmin' || m.id === meId;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-100">{m.name}</div>
                {m.username && <div className="truncate text-xs text-slate-500">@{m.username}</div>}
              </div>
              {locked ? (
                <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">{roleLabel(m.role)}</span>
              ) : (
                <select
                  value={m.role}
                  disabled={busyId === m.id}
                  onChange={(e) => changeRole(m, e.target.value as 'agent' | 'admin')}
                  className="shrink-0 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="agent">{t('staff.roleAgent')}</option>
                  <option value="admin">{t('staff.roleAdmin')}</option>
                </select>
              )}
            </div>
          );
        })}
        {staff.length === 0 && <p className="px-1 text-xs text-slate-500">{t('staff.empty')}</p>}
      </div>
      {status && <p className="px-1 text-xs text-slate-400">{status}</p>}
    </div>
  );
}
