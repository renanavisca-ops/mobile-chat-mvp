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
  const [status, setStatus] = useState<string>('');

  async function onSubmit() {
    setBusy(true);
    setStatus('');

    try {
      const supabase = browserSupabase();

      if (!email.includes('@')) throw new Error('Email inválido.');
      if (password.length < 8) throw new Error('Password mínimo 8 caracteres.');

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // si tienes confirmación por email activada, esto define a dónde redirige el link
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        setStatus('✅ Cuenta creada. Si tu proyecto requiere confirmación por email, revisa tu correo. Luego haz Sign in.');
        return;
      }

      // mode === 'signin'
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      setStatus('✅ Sesión iniciada. Redirigiendo…');
      router.replace('/onboarding');
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title={mode === 'signin' ? 'Sign in' : 'Sign up'}>
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex gap-2">
          <button
            className={[
              'rounded px-3 py-2 text-sm',
              mode === 'signin' ? 'bg-slate-800' : 'bg-slate-950/40 border border-slate-900'
            ].join(' ')}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            className={[
              'rounded px-3 py-2 text-sm',
              mode === 'signup' ? 'bg-slate-800' : 'bg-slate-950/40 border border-slate-900'
            ].join(' ')}
            onClick={() => setMode('signup')}
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
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Password</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 8 characters"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        <button
          className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          onClick={onSubmit}
          disabled={busy}
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <p className="text-sm whitespace-pre-wrap">{status}</p>

        <p className="text-xs text-slate-500">
          Después de entrar, ve a <b>/onboarding</b> para setear username (esto es lo que se busca en Contacts).
        </p>
      </div>
    </PageShell>
  );
}
