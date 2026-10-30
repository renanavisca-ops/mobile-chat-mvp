'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/context';
import {
  isLockEnabled, setPin as savePin, disableLock,
  getAutoLockSeconds, setAutoLockSeconds, AUTO_LOCK_OPTIONS,
} from '@/lib/app-lock';

/** Settings card: enable/disable the PIN app lock and pick the auto-lock delay. */
export function AppLockSettings() {
  const t = useT();
  const [enabled, setEnabled] = useState(isLockEnabled);
  const [autoLock, setAutoLock] = useState(getAutoLockSeconds);
  const [setupOpen, setSetupOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function autoLockLabel(s: number): string {
    if (s === 0) return t('appLock.immediately');
    if (s < 3600) return t('appLock.minutes', { n: String(s / 60) });
    return t('appLock.hours', { n: String(s / 3600) });
  }

  async function confirmSetup() {
    if (pin.length < 4) { setErr(t('appLock.pinTooShort')); return; }
    if (pin !== confirm) { setErr(t('appLock.pinMismatch')); return; }
    setBusy(true);
    try {
      await savePin(pin);
      setEnabled(true);
      setAutoLock(getAutoLockSeconds());
      setSetupOpen(false);
      setPin(''); setConfirm(''); setErr('');
    } finally {
      setBusy(false);
    }
  }

  function turnOff() {
    disableLock();
    setEnabled(false);
    setSetupOpen(false);
  }

  function chooseAutoLock(s: number) {
    setAutoLockSeconds(s);
    setAutoLock(s);
  }

  const field = 'w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-center text-lg tracking-[0.3em] text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-200">{t('appLock.title')}</div>
          <div className="mt-1 text-xs text-slate-400">{t('appLock.desc')}</div>
        </div>
        {enabled && !setupOpen && (
          <button
            onClick={turnOff}
            className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            {t('appLock.turnOff')}
          </button>
        )}
      </div>

      {!enabled && !setupOpen && (
        <button
          onClick={() => { setSetupOpen(true); setErr(''); setPin(''); setConfirm(''); }}
          className="toky-grad toky-ring-brand mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          {t('appLock.enable')}
        </button>
      )}

      {setupOpen && (
        <div className="mt-3 space-y-2">
          <input
            type="password" inputMode="numeric" autoComplete="off" maxLength={12}
            value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr(''); }}
            placeholder={t('appLock.newPin')} className={field}
          />
          <input
            type="password" inputMode="numeric" autoComplete="off" maxLength={12}
            value={confirm} onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, '')); setErr(''); }}
            placeholder={t('appLock.confirmPin')} className={field}
          />
          {err && <p className="text-xs text-rose-400">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setSetupOpen(false)} disabled={busy} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              {t('common.cancel')}
            </button>
            <button onClick={confirmSetup} disabled={busy} className="toky-grad toky-ring-brand flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {enabled ? t('appLock.changePin') : t('appLock.setPin')}
            </button>
          </div>
        </div>
      )}

      {enabled && !setupOpen && (
        <>
          <button
            onClick={() => { setSetupOpen(true); setErr(''); setPin(''); setConfirm(''); }}
            className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('appLock.changePin')}
          </button>

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('appLock.autoLock')}</div>
            <div className="flex flex-wrap gap-2">
              {AUTO_LOCK_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => chooseAutoLock(s)}
                  aria-pressed={autoLock === s}
                  className={`rounded-full px-3 py-1.5 text-xs ${autoLock === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {autoLockLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
