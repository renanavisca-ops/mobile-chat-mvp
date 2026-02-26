'use client';

import { useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function sendMagicLink() {
    setBusy(true);
    setStatus('');
    try {
      const supabase = browserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      setStatus('✅ Magic link sent. Check your email.');
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Login">
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-sm text-slate-300">
          Login with a magic link. After you log in, run <b>/onboarding</b> once to register your device.
        </p>

        <label className="block text-sm text-slate-300">Email</label>
        <input
          className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <button
          className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-60"
          onClick={sendMagicLink}
          disabled={busy || !email.includes('@')}
        >
          {busy ? 'Sending…' : 'Send magic link'}
        </button>

        <p className="text-sm whitespace-pre-wrap">{status}</p>
      </div>
    </PageShell>
  );
}
