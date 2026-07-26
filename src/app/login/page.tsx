'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase/client';
import { reconcileLocalIdentity } from '@/lib/auth/local-identity';
import { validatePassword, passwordStrength } from '@/lib/password';
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
  // True once we know this email exists but hasn't confirmed — surfaces a resend.
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function resendConfirmation() {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) {
      setStatus(`❌ ${t('auth.errorInvalidEmailShort')}`);
      return;
    }
    setBusy(true);
    try {
      const supabase = browserSupabase();
      const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
      const { error } = await supabase.auth.resend({ type: 'signup', email: e, options: { emailRedirectTo } });
      if (error) throw error;
      setStatus(`✅ ${t('auth.statusConfirmResent')}`);
    } catch (err: any) {
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

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
    setNeedsConfirm(false);

    try {
      const supabase = browserSupabase();

      const e = email.trim().toLowerCase();
      if (!e.includes('@')) throw new Error(t('auth.errorInvalidEmailShort'));

      if (mode === 'signup') {
        const pwCheck = validatePassword(password);
        if (!pwCheck.ok) {
          throw new Error(
            pwCheck.code === 'common' ? t('auth.errorPasswordCommon')
            : pwCheck.code === 'weak' ? t('auth.errorPasswordWeak')
            : t('auth.errorPasswordMin'),
          );
        }

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
          reconcileLocalIdentity(data.session.user.id);
          setStatus(`✅ ${t('auth.statusAccountSessionCreated')}`);
          router.replace('/onboarding');
          return;
        }

        // Email confirmation required (dashboard toggle on): no session yet.
        setNeedsConfirm(true);
        setStatus(`✅ ${t('auth.statusAccountCreatedConfirm')}`);
        return;
      }

      // SIGN IN
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        if (String(error.message || '').toLowerCase().includes('confirm')) {
          setNeedsConfirm(true);
          throw new Error(t('auth.errorNotConfirmed'));
        }
        throw error;
      }

      if (!data.session) {
        throw new Error(t('auth.errorNoSession'));
      }

      // Belt-and-suspenders: if a session somehow comes back for an unconfirmed
      // email, refuse it so an unverified address can't be used to sign in.
      if (!data.session.user.email_confirmed_at && !(data.session.user as { confirmed_at?: string }).confirmed_at) {
        await supabase.auth.signOut();
        setNeedsConfirm(true);
        throw new Error(t('auth.errorNotConfirmed'));
      }

      // Clear any previous account's local device/keys before continuing, so a
      // second user on this browser doesn't inherit the first user's identity.
      reconcileLocalIdentity(data.session.user.id);

      // Existing users go straight to their chats; the auth guard sends them
      // to onboarding only if they genuinely have no username yet.
      router.replace('/chats');
    } catch (err: any) {
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-5 py-10 text-slate-50 pt-safe pb-safe">
      <div className="w-full max-w-md space-y-6 toky-rise">
        <div className="flex flex-col items-center text-center">
          <div className="toky-grad toky-ring-brand grid h-20 w-20 place-items-center rounded-[1.4rem] font-display text-4xl font-extrabold text-white">
            T
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
            {t('auth.welcomeTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">{t('auth.welcomeSubtitle')}</p>
        </div>

        {mode !== 'forgot' && (
          <div className="flex gap-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-1">
            <button
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${mode === 'signin' ? 'toky-grad toky-ring-brand text-white' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setMode('signin')}
              disabled={busy}
            >
              {t('auth.signIn')}
            </button>
            <button
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${mode === 'signup' ? 'toky-grad toky-ring-brand text-white' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setMode('signup')}
              disabled={busy}
            >
              {t('auth.signUp')}
            </button>
          </div>
        )}

        <div className="toky-glass toky-elev space-y-4 rounded-3xl border border-slate-800 p-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 ml-1">{t('auth.email')}</label>
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
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
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                type="password"
              />
              {mode === 'signup' && password.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <div className="flex h-1 flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => {
                      const s = passwordStrength(password);
                      const color = s <= 1 ? 'bg-rose-500' : s === 2 ? 'bg-amber-500' : s === 3 ? 'bg-lime-500' : 'bg-emerald-500';
                      return <div key={i} className={`flex-1 rounded-full ${i < s ? color : 'bg-slate-800'}`} />;
                    })}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {(() => {
                      const s = passwordStrength(password);
                      return s <= 1 ? t('auth.pwWeak') : s === 2 ? t('auth.pwFair') : s === 3 ? t('auth.pwGood') : t('auth.pwStrong');
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}

          {mode === 'forgot' ? (
            <div className="space-y-3">
              <button
                className="toky-grad toky-ring-brand w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
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
              className="toky-grad toky-ring-brand w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
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

          {needsConfirm && mode !== 'forgot' && (
            <button
              className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-1 disabled:opacity-50"
              onClick={resendConfirmation}
              disabled={busy}
            >
              {t('auth.resendConfirmation')}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
