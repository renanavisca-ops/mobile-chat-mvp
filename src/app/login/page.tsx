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

      const e = email.trim();
      if (!e.includes('@')) throw new Error('Email inválido.');
      if (password.length < 6) throw new Error('Password mínimo 6 caracteres (mejor 8+).');

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: e, password });
        if (error) throw error;

        setStatus('✅ Cuenta creada. Ahora haz Sign in con tu email y password.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) throw error;

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
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="mínimo 6 (recomendado 8+)"
          />
        </div>

        <button
          className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {status ? <p className="whitespace-pre-wrap text-sm">{status}</p> : null}
      </div>
    </PageShell>
  );
}
