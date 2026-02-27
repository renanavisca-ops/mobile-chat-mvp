'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import { browserSupabase } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // IMPORTANT: do not touch localStorage during prerender
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('username');
      if (saved) setUsername(saved);
    } catch {
      // ignore
    }
  }, []);

  async function runOnboarding() {
    setBusy(true);
    setStatus('Generando llaves locales…');

    try {
      const supabase = browserSupabase();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData.user) throw new Error('No estás autenticado. Ve a /login.');

      const bundle = await createLocalDeviceBundle();
      window.localStorage.setItem('device_bundle', JSON.stringify(bundle));

      const uname = username.trim();
      if (uname) window.localStorage.setItem('username', uname);

      setStatus('Guardando perfil…');
      const { error: profErr } = await supabase.from('profiles').upsert(
        { id: userData.user.id, username: uname || null },
        { onConflict: 'id' }
      );
      if (profErr) throw profErr;

      setStatus('Registrando device…');
      const deviceLabel = `Web-${new Date().toISOString().slice(0, 10)}`;

      const { data: deviceRow, error: devErr } = await supabase
        .from('devices')
        .insert({
          user_id: userData.user.id,
          device_label: deviceLabel,
          registration_id: bundle.registrationId,
          identity_public_key: bundle.identityKey,
          signed_prekey_id: bundle.signedPreKeyId,
          signed_prekey_public: 'mvp',
          signed_prekey_signature: 'mvp'
        })
        .select('id')
        .single();

      if (devErr) throw devErr;

      window.localStorage.setItem('active_device_id', deviceRow.id);

      setStatus(`✅ Listo. Device registrado: ${deviceRow.id}`);
    } catch (e: any) {
      setStatus(`❌ Error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Onboarding">
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-slate-300">
          Este paso crea el “device” del usuario en Supabase (necesario para enviar mensajes) y genera llaves locales.
        </p>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Username (para que te encuentren en Contacts)</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej: jefe"
          />
        </div>

        <button
          className="w-fit rounded bg-blue-600 px-3 py-2 disabled:opacity-60"
          onClick={runOnboarding}
          disabled={busy}
        >
          {busy ? 'Procesando…' : 'Crear device + llaves'}
        </button>

        <p className="mt-3 whitespace-pre-wrap text-sm" aria-live="polite">
          {status}
        </p>
      </div>
    </PageShell>
  );
}
