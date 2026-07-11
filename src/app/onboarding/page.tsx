'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import { useRequireAuth } from '@/lib/auth/use-require-auth';

function sanitizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export default function OnboardingPage() {
  const { loading, user, profile, accessToken } = useRequireAuth();
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // IMPORTANT: do not touch localStorage during prerender
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('username');
      if (saved) {
        setUsername(saved);
        return;
      }
    } catch {
      // ignore
    }

    if (profile?.username) setUsername(profile.username);
  }, [profile?.username]);

  async function runOnboarding() {
    setBusy(true);
    setStatus('Generando llaves locales…');

    try {
      if (loading) throw new Error('Session still loading. Try again.');
      if (!user?.id) throw new Error('No estás autenticado. Ve a /login primero.');
      if (!accessToken) throw new Error('Session token not ready. Refresh and try again.');

      const uname = sanitizeUsername(username.trim());
      if (!uname || uname.length < 3) {
        setStatus('❌ Escribe un username de al menos 3 caracteres para que otros usuarios puedan encontrarte.');
        setBusy(false);
        return;
      }

      window.localStorage.setItem('username', uname);

      const bundle = await createLocalDeviceBundle();
      window.localStorage.setItem('device_bundle', JSON.stringify(bundle));

      setStatus('Guardando perfil y registrando device…');

      const res = await fetch('/api/profiles/me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          username: uname,
          deviceBundle: bundle,
          deviceLabel: `Web-${new Date().toISOString().slice(0, 10)}`,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo guardar perfil/device');
      }

      if (data?.deviceId) {
        window.localStorage.setItem('active_device_id', data.deviceId);
      }

      setStatus(`✅ Listo. Perfil: ${data?.profile?.username ?? uname}. Device registrado: ${data?.deviceId ?? 'existente'}`);
    } catch (e: any) {
      const raw = String(e?.message ?? e ?? '');
      const msg = raw.toLowerCase().includes('duplicate') || raw.toLowerCase().includes('unique')
        ? 'Ese username ya está en uso. Escoge otro.'
        : raw;
      setStatus(`❌ Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Onboarding">
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-slate-300">
          Este paso crea el perfil público del usuario y registra este dispositivo en Supabase.
          El username es obligatorio para que otros usuarios puedan encontrarte en Contacts.
        </p>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Username público</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej: jefe"
          />
          <p className="text-xs text-slate-500">Usa letras, números, punto, guion o guion bajo. Mínimo 3 caracteres.</p>
        </div>

        <button
          className="w-fit rounded bg-blue-600 px-3 py-2 disabled:opacity-60"
          onClick={runOnboarding}
          disabled={busy || loading || !accessToken}
        >
          {busy ? 'Procesando…' : 'Guardar perfil + crear device'}
        </button>

        <p className="mt-3 whitespace-pre-wrap text-sm" aria-live="polite">
          {status}
        </p>
      </div>
    </PageShell>
  );
}
