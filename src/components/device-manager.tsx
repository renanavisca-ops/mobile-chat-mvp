'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { listMyDevices, revokeDevice, type DeviceRow } from '@/lib/db/devices';

/** Settings card: list the account's registered devices and revoke others. */
export function DeviceManager() {
  const { t, lang } = useLanguage();
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listMyDevices().then(setDevices).catch(() => setDevices([]));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function onRevoke(id: string) {
    setBusy(id);
    try {
      await revokeDevice(id);
      setDevices((prev) => (prev ?? []).filter((d) => d.id !== id));
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-200">{t('devices.title')}</div>
      <div className="mt-1 text-xs text-slate-400">{t('devices.desc')}</div>

      <div className="mt-3 space-y-2">
        {devices === null ? (
          [0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-800/60" />)
        ) : devices.length === 0 ? (
          <p className="text-xs text-slate-500">{t('devices.none')}</p>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-900 bg-slate-950/40 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-100">
                  {d.label || t('devices.unnamed')}
                  {d.current && <span className="ml-2 rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/40">{t('devices.thisDevice')}</span>}
                </div>
                <div className="text-[11px] text-slate-500">{t('devices.added', { date: fmt(d.createdAt) })}</div>
              </div>
              {!d.current && (
                <button
                  type="button"
                  onClick={() => onRevoke(d.id)}
                  disabled={busy === d.id}
                  className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-rose-300 hover:bg-slate-700 disabled:opacity-50"
                >
                  {busy === d.id ? t('devices.revoking') : t('devices.revoke')}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">{t('devices.signOutHint')}</p>
    </div>
  );
}
