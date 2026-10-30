'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/context';
import { queryPermission, requestPermission, isRequestable, type PermName, type PermState } from '@/lib/permissions';

const QUERYABLE: PermName[] = ['camera', 'microphone', 'geolocation', 'notifications'];
// Permissions the web layer can't query; requested on first use by the OS.
const ON_USE: { key: string }[] = [{ key: 'contacts' }, { key: 'files' }];

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'camera': return (<svg {...common}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>);
    case 'microphone': return (<svg {...common}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>);
    case 'geolocation': return (<svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>);
    case 'notifications': return (<svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
    case 'contacts': return (<svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
    default: return (<svg {...common}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7" /></svg>);
  }
}

/** Settings card: review and request the permissions Toky uses. */
export function PermissionsSettings() {
  const t = useT();
  const [states, setStates] = useState<Record<string, PermState>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    QUERYABLE.forEach((name) => {
      queryPermission(name).then((s) => setStates((prev) => ({ ...prev, [name]: s })));
    });
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  async function onRequest(name: PermName) {
    setBusy(name);
    try {
      const s = await requestPermission(name);
      setStates((prev) => ({ ...prev, [name]: s }));
    } finally {
      setBusy(null);
    }
  }

  function badge(state: PermState | undefined) {
    const cls =
      state === 'granted' ? 'bg-emerald-600/15 text-emerald-300 ring-emerald-500/40'
      : state === 'denied' ? 'bg-rose-600/15 text-rose-300 ring-rose-500/40'
      : 'bg-slate-700/40 text-slate-300 ring-slate-600/40';
    const label =
      state === 'granted' ? t('permissions.granted')
      : state === 'denied' ? t('permissions.denied')
      : state === 'prompt' ? t('permissions.prompt')
      : t('permissions.onUse');
    return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${cls}`}>{label}</span>;
  }

  const Row = ({ name, label, children }: { name: string; label: string; children?: ReactNode }) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-950/40 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300"><Icon name={name} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-100">{label}</div>
        <div className="text-[11px] text-slate-500">{t(`permissions.use_${name}`)}</div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-200">{t('permissions.title')}</div>
        <div className="mt-1 text-xs text-slate-400">{t('permissions.desc')}</div>
      </div>

      {QUERYABLE.map((name) => {
        const state = states[name];
        const canAsk = (state === 'prompt' || state === undefined) && isRequestable(name);
        return (
          <Row key={name} name={name} label={t(`permissions.name_${name}`)}>
            {canAsk ? (
              <button
                type="button"
                onClick={() => onRequest(name)}
                disabled={busy === name}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy === name ? t('permissions.requesting') : t('permissions.allow')}
              </button>
            ) : (
              badge(state)
            )}
          </Row>
        );
      })}

      {Object.values(states).some((s) => s === 'denied') && (
        <p className="px-1 text-[11px] text-slate-500">{t('permissions.deniedHint')}</p>
      )}

      {ON_USE.map(({ key }) => (
        <Row key={key} name={key} label={t(`permissions.name_${key}`)}>
          {badge('unsupported')}
        </Row>
      ))}
    </div>
  );
}
