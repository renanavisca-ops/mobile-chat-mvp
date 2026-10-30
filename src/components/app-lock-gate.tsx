'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { isLockEnabled, verifyPin, disableLock, markBackgrounded, shouldLockOnResume } from '@/lib/app-lock';

/**
 * Full-screen gate shown when the app lock is on. Appears on launch and after
 * the app returns from the background past the auto-lock timeout. Unlock with
 * the PIN; "forgot" signs out (which disables the lock) so an account login
 * recovers access.
 */
export function AppLockGate() {
  const t = useT();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Lock on first mount if enabled.
  useEffect(() => {
    if (isLockEnabled()) setLocked(true);
  }, []);

  // Lock when leaving to the background (record time) and re-lock on resume.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) markBackgrounded();
      else if (shouldLockOnResume()) setLocked(true);
    };
    const onFocus = () => { if (shouldLockOnResume()) setLocked(true); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', markBackgrounded);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', markBackgrounded);
    };
  }, []);

  useEffect(() => {
    if (locked) {
      setPin('');
      setError(false);
      // Prevent background scroll while locked.
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 50);
      return () => { document.body.style.overflow = prev; };
    }
  }, [locked]);

  const submit = useCallback(async () => {
    if (checking || pin.length < 4) return;
    setChecking(true);
    const ok = await verifyPin(pin);
    setChecking(false);
    if (ok) {
      setLocked(false);
      setPin('');
    } else {
      setError(true);
      setPin('');
      inputRef.current?.focus();
    }
  }, [pin, checking]);

  async function forgot() {
    disableLock();
    setLocked(false);
    try { await browserSupabase().auth.signOut(); } catch { /* ignore */ }
    window.location.href = '/login';
  }

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center">
      <div className="toky-grad grid h-16 w-16 place-items-center rounded-3xl text-white">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <div>
        <h1 className="font-display text-xl font-bold text-slate-100">{t('appLock.lockedTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('appLock.lockedSubtitle')}</p>
      </div>

      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        value={pin}
        onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        placeholder="••••"
        className={`w-44 rounded-2xl border bg-slate-900 px-4 py-3 text-center text-2xl tracking-[0.4em] text-slate-100 focus:outline-none ${
          error ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/40' : 'border-slate-700 focus:ring-2 focus:ring-indigo-500/40'
        }`}
      />
      {error && <p className="-mt-3 text-xs text-rose-400">{t('appLock.wrongPin')}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={checking || pin.length < 4}
        className="toky-grad toky-ring-brand w-44 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {t('appLock.unlock')}
      </button>

      <button type="button" onClick={forgot} className="text-xs text-slate-500 hover:text-slate-300">
        {t('appLock.forgot')}
      </button>
    </div>
  );
}
