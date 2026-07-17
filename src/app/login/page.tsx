'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/context';

type Mode = 'signin' | 'signup' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function handleForgotPassword() {
    if (!email.includes('@')) {
      setStatus(`❌ ${t('auth.errorInvalidEmail')}`);
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const supabase = browserSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(
  email.trim().toLowerCase(),
  {
    redirectTo:
      typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined,
  }
);

      if (error) throw error;

      setStatus(`✅ ${t('auth.statusResetLinkSent')}`);
    } catch (err: any) {
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setStatus('');

    try {
      const supabase = browserSupabase();

      const e = email.trim().toLowerCase();
      if (!e.includes('@')) throw new Error(t('auth.errorInvalidEmailShort'));

      if (mode === 'signup') {
        if (password.length < 6) throw new Error(t('auth.errorPasswordMin'));

        const emailRedirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: e,
          password,
          options: {
            emailRedirectTo
          }
        });

        if (error) throw error;

        const userId = data?.user?.id;
        if (!userId) {
          throw new Error(t('auth.errorNoUserId'));
        }

        if (data.session) {
          setStatus(`✅ ${t('auth.statusAccountSessionCreated')}`);
          router.replace('/onboarding');
          return;
        }

        setStatus(`✅ ${t('auth.statusAccountCreatedConfirm')}`);
        return;
      }

      // SIGN IN
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        if (String(error.message || '').toLowerCase().includes('confirm')) {
          throw new Error(t('auth.errorNotConfirmed'));
        }
        throw error;
      }

      if (!data.session) {
        throw new Error(t('auth.errorNoSession'));
      }

      router.replace('/onboarding');
    } catch (err: any) {
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-5 py-10 text-slate-50 pt-safe pb-safe">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-3xl font-extrabold text-white shadow-lg shadow-blue-600/30">
            T
          </div>
          <h1 className="mt-4 text-2xl font-bold">{t('auth.welcomeTitle')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('auth.welcomeSubtitle')}</p>
        </div>

        {mode !== 'forgot' && (
          <div className="flex gap-2">
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === 'signin' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setMode('signin')}
              disabled={busy}
            >
              {t('auth.signIn')}
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === 'signup' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setMode('signup')}
              disabled={busy}
            >
              {t('auth.signUp')}
            </button>
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-slate-900 bg-slate-950/50 p-6 shadow-xl">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 ml-1">{t('auth.email')}</label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="block text-sm font-medium text-slate-300">{t('auth.password')}</label>
                {mode === 'signin' && (
                  <button
                    onClick={() => {
                      setMode('forgot');
                      setStatus('');
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                )}
              </div>
              <input
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                type="password"
              />
            </div>
          )}

          {mode === 'forgot' ? (
            <div className="space-y-3">
              <button
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
                onClick={handleForgotPassword}
                disabled={busy}
              >
                {busy ? t('auth.sending') : t('auth.sendResetLink')}
              </button>
              <button
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1"
                onClick={() => {
                  setMode('signin');
                  setStatus('');
                }}
                disabled={busy}
              >
                {t('auth.backToSignIn')}
              </button>
            </div>
          ) : (
            <button
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
              onClick={submit}
              disabled={busy}
            >
              {busy ? t('auth.working') : mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
            </button>
          )}

          {!!status && (
            <div className={`mt-4 p-3 rounded-lg border text-xs whitespace-pre-wrap ${
              status.startsWith('✅')
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {status}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
