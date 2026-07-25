'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { ensureIdentity, getMyIdentityPub } from '@/lib/crypto/keystore';
import { browserSupabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/auth/use-session';
import { useT, TransBold } from '@/lib/i18n/context';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const t = useT();
  const { user, profile, loading } = useSession();
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [avail, setAvail] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  // Recognize returning users: if this account already has a username (even on
  // a fresh device with empty localStorage), skip onboarding and go to chats.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (profile?.username) {
      router.replace('/chats');
    }
  }, [loading, user, profile, router]);

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
    const timer = setTimeout(async () => {
      try {
        const supabase = browserSupabase();
        const { data, error } = await supabase.rpc('username_available', { candidate: u });
        if (error) throw error;
        setAvail(data ? 'ok' : 'taken');
      } catch {
        setAvail('idle');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  async function runOnboarding() {
    const uname = username.trim();

    if (!USERNAME_RE.test(uname)) {
      setStatus(`❌ ${t('onboarding.errorInvalidUsername')}`);
      return;
    }

    setBusy(true);
    setStatus(t('onboarding.statusCheckingAvailability'));

    try {
      const supabase = browserSupabase();

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setStatus(`❌ ${t('onboarding.errorNotAuthenticated')}`);
        setBusy(false);
        return;
      }
      const userId = userData.user.id;

      // Availability (final check; DB unique index is the source of truth)
      const { data: isFree } = await supabase.rpc('username_available', { candidate: uname });
      if (isFree === false) {
        setStatus(`❌ ${t('onboarding.errorUsernameTaken')}`);
        setBusy(false);
        return;
      }

      setStatus(t('onboarding.statusGeneratingKeys'));
      // Real end-to-end-encryption identity: creates the private key on this
      // device and publishes the public key so others can encrypt to us. This
      // is what lets direct chats be encrypted by default.
      await ensureIdentity();
      const identityPub = await getMyIdentityPub();
      const registrationId = Math.floor(Math.random() * 16380) + 1;
      window.localStorage.setItem('username', uname);

      setStatus(t('onboarding.statusSavingProfile'));
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert({ id: userId, username: uname, role: 'agent' }, { onConflict: 'id' });
      if (profErr) {
        const msg = String(profErr.message ?? '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          setStatus(`❌ ${t('onboarding.errorUsernameTaken')}`);
          setBusy(false);
          return;
        }
        throw profErr;
      }

      setStatus(t('onboarding.statusRegisteringDevice'));
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
            registration_id: registrationId,
            identity_public_key: identityPub ? JSON.stringify(identityPub) : 'e2ee',
            signed_prekey_id: 1,
            signed_prekey_public: 'e2ee',
            signed_prekey_signature: 'e2ee',
          })
          .select('id')
          .single();
        if (devErr) throw devErr;
        deviceId = deviceRow.id;
      }

      window.localStorage.setItem('active_device_id', deviceId);
      setStatus(`✅ ${t('onboarding.statusDone')}`);
      router.replace('/chats');
    } catch (e: any) {
      setStatus(`❌ ${t('onboarding.errorPrefix')}: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const availMsg = {
    idle: '',
    checking: t('onboarding.availChecking'),
    ok: `✅ ${t('onboarding.availOk')}`,
    taken: `❌ ${t('onboarding.availTaken')}`,
    invalid: t('onboarding.availInvalid'),
  }[avail];

  return (
    <PageShell title={t('onboarding.title')}>
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-slate-300">
          <TransBold text={t('onboarding.intro')} />
        </p>

        <div className="space-y-2">
          <label className="block text-sm text-slate-300">{t('onboarding.username')}</label>
          <input
            className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('onboarding.usernamePlaceholder')}
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
          className="w-fit rounded toky-grad toky-ring-brand px-4 py-2 disabled:opacity-60"
          onClick={runOnboarding}
          disabled={busy || avail === 'taken' || avail === 'invalid'}
        >
          {busy ? t('onboarding.processing') : t('onboarding.save')}
        </button>

        <p className="mt-3 whitespace-pre-wrap text-sm" aria-live="polite">
          {status}
        </p>
      </div>
    </PageShell>
  );
}
