'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import { browserSupabase } from '@/lib/supabase/client';

function sanitizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

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

      let userId: string;
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          setStatus('❌ No estás autenticado. Ve a /login primero.');
          setBusy(false);
          return;
        }
        userId = userData.user.id;
      } catch {
        setStatus('❌ Error al verificar sesión. Intenta recargar la página.');
        setBusy(false);
        return;
      }

      const uname = sanitizeUsername(username.trim());
      if (!uname || uname.length < 3) {
        setStatus('❌ Escribe un username de al menos 3 caracteres para que otros usuarios puedan encontrarte.');
        setBusy(false);
        return;
      }

      window.localStorage.setItem('username', uname);

      const bundle = await createLocalDeviceBundle();
      window.localStorage.setItem('device_bundle', JSON.stringify(bundle));

      setStatus('Guardando perfil…');
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert(
          [{ id: userId, username: uname, role: 'agent' }] as any,
          { onConflict: 'id', ignoreDuplicates: false }
        );

      if (profErr) throw profErr;

      setStatus('Registrando device…');
      const deviceLabel = `Web-${new Date().toISOString().slice(0, 10)}`;

      const { data: deviceRow, error: devErr } = await supabase
        .from('devices')
        .insert([
          {
            user_id: userId,
            device_label: deviceLabel,
            registration_id: bundle.registrationId,
            identity_public_key: bundle.identityKey,
            signed_prekey_id: bundle.signedPreKeyId,
            signed_prekey_public: bundle.signedPreKeyPublic,
            signed_prekey_signature: bundle.signedPreKeySignature,
          },
        ] as any)
        .select('id')
        .single();

      if (devErr) throw devErr;

      window.localStorage.setItem('active_device_id', (deviceRow as any)?.id);

      setStatus(`✅ Listo. Perfil: ${uname}. Device registrado: ${(deviceRow as any)?.id}`);
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
          disabled={busy}
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
