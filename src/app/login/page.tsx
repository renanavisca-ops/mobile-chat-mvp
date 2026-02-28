'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function submit() {
    setBusy(true);
    setStatus('');

    try {
      const supabase = browserSupabase();

      const e = email.trim().toLowerCase();
      if (!e.includes('@')) throw new Error('Email inválido.');
      if (password.length < 6) throw new Error('Password mínimo 6 caracteres (mejor 8+).');

      if (mode === 'signup') {
        const emailRedirectTo =
          typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: e,
          password,
          options: {
            // Si Email confirmations está ON, Supabase mandará un correo y usará este redirect.
            emailRedirectTo
          }
        });

        if (error) throw error;

        // data.user normalmente existe si se creó. data.session solo existe si NO requiere confirmación por email.
        const userId = data?.user?.id;

        if (!userId) {
          // Caso raro, pero lo dejamos explícito para que no “parezca” éxito.
          throw new Error(
            'Supabase no devolvió user.id en signUp. Revisa Auth settings (signups/confirmations) y logs.'
          );
        }

        if (data.session) {
          // Email confirmations OFF => ya hay sesión
          setStatus('✅ Cuenta creada y sesión iniciada. Redirigiendo a onboarding…');
          router.replace('/onboarding');
          return;
        }

        // Email confirmations ON => no hay sesión aún
        setStatus(
          `✅ Usuario creado en Supabase (id: ${userId}).\n` +
            `📩 Falta confirmar el email.\n` +
            `1) Revisa tu correo (y spam)\n` +
            `2) Confirma\n` +
            `3) Luego vuelve aquí e inicia sesión.`
        );
        return;
      }

      // SIGN IN
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) {
        // Mensaje típico cuando confirmations está ON y no confirmaste
        if (String(error.message || '').toLowerCase().includes('confirm')) {
          throw new Error('Email no confirmado. Revisa tu correo y confirma antes de iniciar sesión.');
        }
        throw error;
      }

      if (!data.session) {
        throw new Error('No se pudo iniciar sesión (session null). Revisa settings de Supabase Auth.');
      }

      router.replace('/onboarding');
    } catch (err: any) {
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title={mode === 'signin' ? 'Sign in' : 'Sign up'}>
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex gap-2">
          <button
            className={`rounded px-3 py-2 text-sm ${mode === 'signin' ? 'bg-slate-800' : 'border border-slate-900 bg-slate-950/40'}`}
            onClick={() => setMode('signin')}
            disabled={busy}
          >
            Sign in
          </button>
          <button
            className={`rounded px-3 py-2 text-sm ${mode === 'signup' ? 'bg-slate-800' : 'border border-slate-900 bg-slate-950/40'}`}
            onClick={() => setMode('signup')}
            disabled={busy}
          >
            Sign up
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Email</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Password</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            type="password"
          />
        </div>

        <button
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {!!status && (
          <pre className="whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
            {status}
          </pre>
        )}
      </div>
    </PageShell>
  );
}
