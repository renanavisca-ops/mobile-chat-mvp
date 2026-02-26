'use client';

import { useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import { browserSupabase } from '@/lib/supabase/client';

export default function OnboardingPage() {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function runOnboarding() {
    setBusy(true);
    setStatus('Generando llaves locales…');

    try {
      const supabase = browserSupabase();

      // 1) Asegurar sesión
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData.user) throw new Error('No estás autenticado. Ve a /login.');

      // 2) Generar bundle local (Signal-ish)
      const bundle = await createLocalDeviceBundle();
      localStorage.setItem('device_bundle', JSON.stringify(bundle));

      // 3) Crear/actualizar profile mínimo (si ya existe, no pasa nada)
      //    (Solo para que luego puedas buscar contactos por username, etc.)
      const existingUsername = localStorage.getItem('username') || null;
      await supabase.from('profiles').upsert(
        {
          id: userData.user.id,
          username: existingUsername
        },
        { onConflict: 'id' }
      );

      // 4) Registrar dispositivo en DB (mínimo viable)
      //    IMPORTANTE: Tu schema exige signed_prekey_public y signature, pero tu bundle no los trae,
      //    así que usamos placeholders "mvp" por ahora (luego lo hacemos real).
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

      // Guardamos el device id para usarlo al enviar mensajes
      localStorage.setItem('active_device_id', deviceRow.id);

      setStatus(`✅ Listo. Device registrado: ${deviceRow.id}`);
    } catch (e: any) {
      setStatus(`❌ Error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Onboarding">
      <p className="text-sm text-slate-300">
        Este paso crea el “device” del usuario en Supabase (necesario para enviar mensajes) y genera llaves locales.
      </p>

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
    </PageShell>
  );
}
