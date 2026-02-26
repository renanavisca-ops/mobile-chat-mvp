'use client';

import { useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';
import { emailSchema } from '@/lib/validation/schemas';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus('Correo inválido.');
      return;
    }
    const supabase = browserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
  email: parsed.data,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});
    setStatus(error ? error.message : 'Enlace de acceso enviado.');
  }

  return (
    <PageShell title="Login">
      <form className="flex max-w-md flex-col gap-3" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input
          className="rounded border border-slate-700 bg-slate-900 p-2"
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button className="rounded bg-blue-600 px-3 py-2" type="submit">
          Enviar magic link
        </button>
        <p aria-live="polite" className="text-sm text-slate-300">
          {status}
        </p>
      </form>
    </PageShell>
  );
}
