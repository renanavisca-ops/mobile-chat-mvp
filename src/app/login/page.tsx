'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function handleForgotPassword() {
    if (!email.includes('@')) {
      setStatus('❌ Por favor ingresa un email válido.');
      return;
    }

    setBusy(true);
    setStatus('');

    try {
      const supabase = browserSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());

      if (error) throw error;

      setStatus('✅ Enlace de recuperación enviado. Revisa tu correo.');
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
      if (!e.includes('@')) throw new Error('Email inválido.');
      
      if (mode === 'signup') {
        if (password.length < 6) throw new Error('Password mínimo 6 caracteres.');
        const emailRedirectTo =
          typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

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
          throw new Error('Supabase no devolvió user.id en signUp.');
        }

        if (data.session) {
          setStatus('✅ Cuenta creada y sesión iniciada. Redirigiendo...');
          router.replace('/onboarding');
          return;
        }

        setStatus(
          `✅ Usuario creado.\n` +
            `📩 Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.`
        );
        return;
      }

      // SIGN IN
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        if (String(error.message || '').toLowerCase().includes('confirm')) {
          throw new Error('Email no confirmado. Revisa tu correo antes de iniciar sesión.');
        }
        throw error;
      }

      if (!data.session) {
        throw new Error('No se pudo iniciar sesión.');
      }

      router.replace('/onboarding');
    } catch (err: any) {
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title={mode === 'forgot' ? 'Recuperar acceso' : mode === 'signin' ? 'Sign in' : 'Sign up'}>
      <div className="mx-auto max-w-md space-y-4">
        {mode !== 'forgot' && (
          <div className="flex gap-2">
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === 'signin' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setMode('signin')}
              disabled={busy}
            >
              Sign in
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === 'signup' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              onClick={() => setMode('signup')}
              disabled={busy}
            >
              Sign up
            </button>
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-slate-900 bg-slate-950/50 p-6 shadow-xl">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300 ml-1">Email</label>
            <input
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="block text-sm font-medium text-slate-300">Contraseña</label>
                {mode === 'signin' && (
                  <button 
                    onClick={() => {
                      setMode('forgot');
                      setStatus('');
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
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
                {busy ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
              <button
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1"
                onClick={() => {
                  setMode('signin');
                  setStatus('');
                }}
                disabled={busy}
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <button
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
              onClick={submit}
              disabled={busy}
            >
              {busy ? 'Trabajando...' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
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
    </PageShell>
  );
}
