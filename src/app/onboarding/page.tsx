'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { createLocalDeviceBundle } from '@/lib/crypto/device';
import { browserSupabase } from '@/lib/supabase/client';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [avail, setAvail] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('username');
      if (saved) setUsername(saved);
    } catch {
      // ignore
    }
  }, []);

  // Live availability check (debounced)
  useEffect(() => {
    const u = username.trim();
    if (!u) {
      setAvail('idle');
      return;
    }
    if (!USERNAME_RE.test(u)) {
      setAvail('invalid');
      return;
    }
    setAvail('checking');
    const t = setTimeout(async () => {
      try {
        const supabase = browserSupabase();
        const { data, error } = await supabase.rpc('username_available', { candidate: u });
        if (error) throw error;
        setAvail(data ? 'ok' : 'taken');
      } catch {
        setAvail('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  async function runOnboarding() {
    const uname = username.trim();

    if (!USERNAME_RE.test(uname)) {
      setStatus('❌ El username debe tener 3–20 caracteres: letras, números o guion bajo.');
      return;
    }

    setBusy(true);
    setStatus('Verificando disponibilidad…');

    try {
      const supabase = browserSupabase();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setStatus('❌ No estás autenticado. Ve a /login primero.');
        setBusy(false);
        return;
      }
      const userId = userData.user.id;

      // Availability (final check; DB unique index is the source of truth)
      const { data: isFree } = await supabase.rpc('username_available', { candidate: uname });
      if (isFree === false) {
        setStatus('❌ Ese username ya está en uso. Elige otro.');
        setBusy(false);
        return;
      }

      setStatus('Generando llaves locales…');
      const bundle = await createLocalDeviceBundle();
      window.localStorage.setItem('device_bundle', JSON.stringify(bundle));
      window.localStorage.setItem('username', uname);

      setStatus('Guardando perfil…');
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, username: uname, role: 'agent' }, { onConflict: 'id' });
      if (profErr) {
        const msg = String(profErr.message ?? '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          setStatus('❌ Ese username ya está en uso. Elige otro.');
          setBusy(false);
          return;
        }
        throw profErr;
      }

      setStatus('Registrando dispositivo…');
      const deviceLabel = `Web-${new Date().toISOString().slice(0, 10)}`;

      // Reuse an existing device if present (devices.user_id is unique)
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      let deviceId = existing?.[0]?.id;

      if (!deviceId) {
        const { data: deviceRow, error: devErr } = await supabase
          .from('devices')
          .insert({
            user_id: userId,
            device_label: deviceLabel,
            registration_id: bundle.registrationId,
            identity_public_key: bundle.identityKey,
            signed_prekey_id: bundle.signedPreKeyId,
            signed_prekey_public: 'mvp',
            signed_prekey_signature: 'mvp',
          })
          .select('id')
          .single();
        if (devErr) throw devErr;
        deviceId = deviceRow.id;
      }

      window.localStorage.setItem('active_device_id', deviceId);
      setStatus('✅ Listo. Redirigiendo…');
      router.replace('/chats');
    } catch (e: any) {
      setStatus(`❌ Error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const availMsg = {
    idle: '',
    checking: 'Comprobando…',
    ok: '✅ Disponible',
    taken: '❌ Ya está en uso',
    invalid: '3–20 caracteres: letras, números o _',
  }[avail];

  return (
    <PageShell title="Elige tu username">
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-slate-300">
          Elige un <b>username único</b> para que otras personas puedan encontrarte y chatear contigo.
          Esto también registra tu dispositivo para enviar mensajes.
        </p>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">Username</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej: ana_lopez"
            autoCapitalize="none"
            autoComplete="username"
          />
          <div
            className={`text-xs ${
              avail === 'ok' ? 'text-emerald-400' : avail === 'taken' || avail === 'invalid' ? 'text-rose-400' : 'text-slate-500'
            }`}
          >
            {availMsg}
          </div>
        </div>

        <button
          className="w-fit rounded bg-blue-600 px-4 py-2 disabled:opacity-60"
          onClick={runOnboarding}
          disabled={busy || avail === 'taken' || avail === 'invalid'}
        >
          {busy ? 'Procesando…' : 'Guardar y continuar'}
        </button>

        <p className="mt-3 whitespace-pre-wrap text-sm" aria-live="polite">
          {status}
        </p>
      </div>
    </PageShell>
  );
}
