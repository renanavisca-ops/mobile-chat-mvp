'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';
import { clearLocalIdentity } from '@/lib/auth/local-identity';
import { WALLPAPERS, CUSTOM_WALLPAPER_ID, getWallpaperId, setWallpaperId as saveWallpaperId, uploadCustomWallpaper, getCustomWallpaperUrl } from '@/lib/wallpaper';
import { uploadAvatar } from '@/lib/db/avatar';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, pushSupported } from '@/lib/push';
import { isNativeApp } from '@/lib/native-push';
import {
  initKeystore,
  isUnlocked,
  enrollNewIdentity,
  hasPublishedIdentity,
  hasServerBackup,
  saveBackup,
  restoreFromPassphrase,
  myFingerprint,
} from '@/lib/crypto/keystore';
import { useLanguage, TransBold, type LangPreference } from '@/lib/i18n/context';
import { useTheme, type Accent } from '@/lib/theme';
import { AvatarCreator } from '@/components/avatar-creator';

export default function SettingsPage() {
  const supabase = browserSupabase();
  const { t, preference, setPreference } = useLanguage();
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    highContrast,
    setHighContrast,
    fontScale,
    setFontScale,
    simpleMode,
    setSimpleMode,
  } = useTheme();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [showOnline, setShowOnline] = useState<boolean>(true);
  const [readReceipts, setReadReceipts] = useState<boolean>(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const [wallpaperId, setWpId] = useState('default');
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(null);
  const [wallpaperUploadBusy, setWallpaperUploadBusy] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCreatorOpen, setAvatarCreatorOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { permission } = useNotifications();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState('');
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    isPushSubscribed().then(setPushOn).catch(() => {});
  }, []);

  async function togglePush() {
    if (!user) return;
    setPushBusy(true);
    setPushErr('');
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
      } else {
        await subscribeToPush(user.id);
        setPushOn(true);
      }
    } catch (e: any) {
      setPushErr(e?.message ?? String(e));
    } finally {
      setPushBusy(false);
    }
  }

  // Re-subscribe from scratch (e.g. after the server's VAPID keys changed and
  // the old subscription became stale).
  async function resubscribePush() {
    if (!user) return;
    setPushBusy(true);
    setPushErr('');
    try {
      await unsubscribeFromPush().catch(() => {});
      await subscribeToPush(user.id);
      setPushOn(true);
    } catch (e: any) {
      setPushErr(e?.message ?? String(e));
    } finally {
      setPushBusy(false);
    }
  }

  // --- End-to-end encryption ---
  const [encEnrolled, setEncEnrolled] = useState(false);
  const [encHasBackup, setEncHasBackup] = useState(false);
  const [encFingerprint, setEncFingerprint] = useState<string | null>(null);
  const [encBusy, setEncBusy] = useState(false);
  const [encMsg, setEncMsg] = useState('');
  const [encPass, setEncPass] = useState('');
  const [showRestore, setShowRestore] = useState(false);

  async function refreshEnc() {
    await initKeystore();
    setEncEnrolled(isUnlocked());
    setEncHasBackup(await hasServerBackup().catch(() => false));
    setEncFingerprint(await myFingerprint().catch(() => null));
  }

  useEffect(() => {
    refreshEnc().catch(() => {});
  }, []);

  async function setUpEncryption() {
    setEncBusy(true);
    setEncMsg('');
    try {
      await initKeystore();
      if (isUnlocked()) {
        // already set up on this device
      } else if (await hasPublishedIdentity()) {
        // An identity already exists for this account (set up on another
        // device). We must restore it here rather than generate a new one.
        setShowRestore(true);
        setEncMsg(t('settings.encRestoreNeeded'));
        return;
      } else {
        await enrollNewIdentity();
      }
      await refreshEnc();
      setEncMsg(t('settings.encReady'));
    } catch (e: any) {
      setEncMsg(e?.message ?? String(e));
    } finally {
      setEncBusy(false);
    }
  }

  async function saveBackupNow() {
    if (encPass.length < 8) {
      setEncMsg(t('settings.encPassTooShort'));
      return;
    }
    setEncBusy(true);
    setEncMsg('');
    try {
      await saveBackup(encPass);
      setEncPass('');
      await refreshEnc();
      setEncMsg(t('settings.encBackupSaved'));
    } catch (e: any) {
      setEncMsg(e?.message ?? String(e));
    } finally {
      setEncBusy(false);
    }
  }

  async function restoreNow() {
    if (!encPass) return;
    setEncBusy(true);
    setEncMsg('');
    try {
      await restoreFromPassphrase(encPass);
      setEncPass('');
      setShowRestore(false);
      await refreshEnc();
      setEncMsg(t('settings.encReady'));
    } catch (e: any) {
      setEncMsg(t('settings.encRestoreFailed'));
    } finally {
      setEncBusy(false);
    }
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  async function deleteAccount() {
    setDeleteBusy(true);
    setDeleteErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete account');
      }
      // Clean this device: drop the push subscription/token, wipe the local
      // identity + encryption keys (IndexedDB), clear the consent record, then
      // sign out and return to the login screen.
      await unsubscribeFromPush().catch(() => {});
      clearLocalIdentity();
      try {
        localStorage.removeItem('toky_consent_v1');
      } catch {
        // ignore storage errors
      }
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (e: any) {
      setDeleteErr(e?.message ?? String(e));
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    setActiveDeviceId(localStorage.getItem('active_device_id'));
    const id = getWallpaperId();
    setWpId(id);
    if (id === CUSTOM_WALLPAPER_ID) {
      getCustomWallpaperUrl().then(setCustomWallpaperUrl).catch(() => {});
    }
  }, []);

  function chooseWallpaper(id: string) {
    saveWallpaperId(id);
    setWpId(id);
  }

  async function onWallpaperFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setWallpaperUploadBusy(true);
    setStatus('');
    try {
      await uploadCustomWallpaper(user.id, file);
      setWpId(CUSTOM_WALLPAPER_ID);
      const url = await getCustomWallpaperUrl();
      setCustomWallpaperUrl(url);
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setWallpaperUploadBusy(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    setStatus('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null })
        .eq('id', user.id);
      if (error) throw error;
      setStatus(`✅ ${t('settings.profileUpdated')}`);
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setAvatarBusy(true);
    setStatus('');
    try {
      const url = await uploadAvatar(user.id, file);
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
      setStatus(`✅ ${t('settings.photoUpdated')}`);
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // Get current user
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUser = sessionData.session?.user ?? null;

        if (mounted) {
          setUser(currentUser);
        }

        if (!currentUser) {
          if (mounted) {
            setProfile({ username: 'User', role: 'agent' });
            setLoading(false);
          }
          return;
        }

        // Load profile — use .limit(1) instead of .single() to avoid throws
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .limit(1);

        if (error) {
          console.error('Profile load error:', error);
        }

        if (mounted) {
          const prof = data?.[0] ?? {
            username: 'User',
            role: 'agent'
          };
          setProfile(prof);
          setShowOnline((prof as any)?.show_online ?? true);
          setReadReceipts((prof as any)?.read_receipts ?? true);
          setDisplayName((prof as any)?.display_name ?? '');
          setAvatarUrl((prof as any)?.avatar_url ?? null);
        }

      } catch (e) {
        console.error('Unexpected error:', e);

        if (mounted) {
          setProfile({
            username: 'User',
            role: 'agent'
          });
        }

      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function signOut() {
    setStatus('');
    await supabase.auth.signOut();
    // Wipe this account's local device/keys so the next user to sign in on this
    // browser doesn't inherit them.
    clearLocalIdentity();
    // Send the user back to the front page, not the (now signed-out) settings.
    window.location.href = '/login';
  }

  async function toggleShowOnline() {
    if (!user) return;
    const next = !showOnline;
    setShowOnline(next);
    setSavingPrivacy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_online: next })
        .eq('id', user.id);
      if (error) throw error;
      // Reload so the global presence channel re-evaluates (start/stop broadcasting)
      setTimeout(() => window.location.reload(), 250);
    } catch (e: any) {
      setShowOnline(!next); // revert on failure
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function toggleReadReceipts() {
    if (!user) return;
    const next = !readReceipts;
    setReadReceipts(next);
    setSavingPrivacy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ read_receipts: next } as any)
        .eq('id', user.id);
      if (error) throw error;
    } catch (e: any) {
      setReadReceipts(!next); // revert on failure
      setStatus(`❌ ${e?.message ?? String(e)}`);
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus({ type: null, message: '' });

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: t('settings.passwordTooShort') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: t('settings.passwordMismatch') });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordStatus({ type: 'success', message: t('settings.passwordUpdated') });
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.message || t('settings.passwordUpdateError') });
    } finally {
      setIsUpdating(false);
    }
  }

  const langOptions: { key: LangPreference; label: string }[] = [
    { key: 'auto', label: t('settings.languageAuto') },
    { key: 'en', label: t('settings.languageEnglish') },
    { key: 'es', label: t('settings.languageSpanish') },
  ];

  const themeOptions: { key: 'auto' | 'dark' | 'light'; label: string }[] = [
    { key: 'auto', label: t('settings.themeAuto') },
    { key: 'dark', label: t('settings.themeDark') },
    { key: 'light', label: t('settings.themeLight') },
  ];

  const accentOptions: { key: Accent; label: string; swatch: string }[] = [
    { key: 'blue', label: t('settings.accentBlue'), swatch: '#3b82f6' },
    { key: 'violet', label: t('settings.accentViolet'), swatch: '#8b5cf6' },
    { key: 'teal', label: t('settings.accentTeal'), swatch: '#14b8a6' },
    { key: 'fuchsia', label: t('settings.accentFuchsia'), swatch: '#d946ef' },
  ];

  const fontScaleOptions: { key: 'normal' | 'lg' | 'xl'; label: string }[] = [
    { key: 'normal', label: t('settings.fontSizeNormal') },
    { key: 'lg', label: t('settings.fontSizeLarge') },
    { key: 'xl', label: t('settings.fontSizeXLarge') },
  ];

  return (
    <PageShell title={t('nav.settings')}>
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-slate-300 animate-pulse">{t('settings.loading')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile hero — gradient cover with avatar, name and handle. */}
          <section className="overflow-hidden rounded-3xl border border-slate-800 toky-elev">
            <div className="toky-grad h-24" />
            <div className="-mt-10 flex flex-col items-center px-4 pb-5 text-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-20 w-20 rounded-3xl object-cover ring-4 ring-slate-950" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-800 text-2xl font-bold text-white ring-4 ring-slate-950">
                  {(displayName || profile?.username || '?').trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div className="mt-3 font-display text-xl font-bold">
                {displayName || profile?.username || t('settings.noUsername')}
              </div>
              {profile?.username && <div className="text-sm text-slate-400">@{profile.username}</div>}
              <div className="mt-1 text-xs text-slate-500">{user?.email ?? user?.id ?? ''}</div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionDevice')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">{t('settings.activeDeviceId')}</div>
              <div className="text-xs text-slate-400 mt-1">{activeDeviceId ?? t('settings.noDevice')}</div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionProfile')}</h2>
            <div className="space-y-4 rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-slate-800 object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 text-lg font-semibold text-slate-300">
                    {(displayName || profile?.username || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarBusy}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {avatarBusy ? t('settings.uploading') : t('settings.changePhoto')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarCreatorOpen(true)}
                    disabled={avatarBusy}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {t('settings.createAvatar')}
                  </button>
                  <input ref={avatarInputRef} type="file" hidden accept="image/*" onChange={onAvatarChange} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 block text-xs text-slate-400">{t('settings.displayName')}</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  placeholder={profile?.username ?? t('settings.displayNamePlaceholder')}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <div className="ml-1 text-xs text-slate-500">{t('settings.username')}: {profile?.username ?? t('settings.noUsername')}</div>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingProfile ? t('settings.savingProfile') : t('settings.saveProfile')}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionLanguage')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {langOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPreference(opt.key)}
                    aria-pressed={preference === opt.key}
                    className={`rounded-lg px-3 py-1.5 text-sm transition ${
                      preference === opt.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionAppearance')}</h2>
            <div className="space-y-4 rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div>
                <div className="mb-2 text-sm font-medium text-slate-200">{t('settings.themeLabel')}</div>
                <div className="flex flex-wrap gap-2">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTheme(opt.key)}
                      aria-pressed={theme === opt.key}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        theme === opt.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-200">{t('settings.accentLabel')}</div>
                <div className="flex flex-wrap gap-3">
                  {accentOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setAccent(opt.key)}
                      aria-pressed={accent === opt.key}
                      title={opt.label}
                      className={`h-9 w-9 rounded-full border-2 transition ${
                        accent === opt.key ? 'border-white' : 'border-transparent hover:border-slate-500'
                      }`}
                      style={{ background: opt.swatch }}
                    >
                      {accent === opt.key && <span className="text-white text-sm">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{t('settings.highContrastLabel')}</div>
                  <div className="mt-1 text-xs text-slate-400">{t('settings.highContrastDesc')}</div>
                </div>
                <button
                  onClick={() => setHighContrast(!highContrast)}
                  role="switch"
                  aria-checked={highContrast}
                  aria-label={t('settings.highContrastLabel')}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    highContrast ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      highContrast ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{t('settings.simpleModeLabel')}</div>
                  <div className="mt-1 text-xs text-slate-400">{t('settings.simpleModeDesc')}</div>
                </div>
                <button
                  onClick={() => setSimpleMode(!simpleMode)}
                  role="switch"
                  aria-checked={simpleMode}
                  aria-label={t('settings.simpleModeLabel')}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    simpleMode ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      simpleMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-200">{t('settings.fontSizeLabel')}</div>
                <div className="flex flex-wrap gap-2">
                  {fontScaleOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFontScale(opt.key)}
                      aria-pressed={fontScale === opt.key}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        fontScale === opt.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionWallpaper')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">{t('settings.chooseWallpaper')}</div>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
                {WALLPAPERS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => chooseWallpaper(w.id)}
                    title={w.name}
                    aria-pressed={wallpaperId === w.id}
                    className={`relative h-14 rounded-lg border-2 transition ${
                      wallpaperId === w.id ? 'border-indigo-500' : 'border-slate-800 hover:border-slate-600'
                    }`}
                    style={{ background: w.css || '#0f1420' }}
                  >
                    {wallpaperId === w.id && (
                      <span className="absolute inset-0 grid place-items-center text-white text-sm">✓</span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => wallpaperInputRef.current?.click()}
                  disabled={wallpaperUploadBusy}
                  title={t('settings.uploadFromLibrary')}
                  aria-pressed={wallpaperId === CUSTOM_WALLPAPER_ID}
                  className={`relative h-14 overflow-hidden rounded-lg border-2 transition disabled:opacity-50 ${
                    wallpaperId === CUSTOM_WALLPAPER_ID ? 'border-indigo-500' : 'border-slate-800 hover:border-slate-600'
                  }`}
                  style={
                    wallpaperId === CUSTOM_WALLPAPER_ID && customWallpaperUrl
                      ? { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: '#0f1420' }
                  }
                >
                  <span className="absolute inset-0 grid place-items-center bg-black/30 text-lg text-white">
                    {wallpaperUploadBusy ? '…' : '🖼️'}
                  </span>
                </button>
                <input ref={wallpaperInputRef} type="file" hidden accept="image/*" onChange={onWallpaperFileChange} />
              </div>
              <div className="mt-2 text-xs text-slate-500">{t('settings.wallpaperSavedNote')}</div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionPrivacy')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-200">{t('settings.showOnlineStatus')}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {t('settings.showOnlineStatusDesc')}
                </div>
              </div>
              <button
                onClick={toggleShowOnline}
                disabled={savingPrivacy}
                role="switch"
                aria-checked={showOnline}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  showOnline ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showOnline ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-200">{t('settings.readReceipts')}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {t('settings.readReceiptsDesc')}
                </div>
              </div>
              <button
                onClick={toggleReadReceipts}
                disabled={savingPrivacy}
                role="switch"
                aria-checked={readReceipts}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  readReceipts ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    readReceipts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionSecurity')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 block ml-1">{t('settings.currentPassword')}</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 block ml-1">{t('settings.newPassword')}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder={t('settings.minChars')}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 block ml-1">{t('settings.confirmPassword')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {passwordStatus.message && (
                  <div className={`text-xs p-2 rounded ${passwordStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    {passwordStatus.type === 'success' ? '✅ ' : '❌ '}
                    {passwordStatus.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? t('settings.updatingPassword') : t('settings.changePassword')}
                </button>
              </form>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionNotifications')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{t('settings.pushNotifications')}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {!pushSupported()
                      ? t('settings.pushUnsupported')
                      : !isNativeApp() && permission === 'denied'
                      ? t('settings.pushBlocked')
                      : pushOn
                      ? t('settings.pushGranted')
                      : t('settings.pushPrompt')}
                  </div>
                </div>
                {pushSupported() && (
                  <button
                    onClick={togglePush}
                    disabled={pushBusy || (!isNativeApp() && permission === 'denied')}
                    role="switch"
                    aria-checked={pushOn}
                    aria-label={t('settings.pushNotifications')}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      pushOn ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        pushOn ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>
              {pushOn && pushSupported() && (
                <button
                  type="button"
                  onClick={resubscribePush}
                  disabled={pushBusy}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  {pushBusy ? t('settings.enabling') : t('settings.pushResubscribe')}
                </button>
              )}
              {pushErr && <p className="mt-2 text-xs text-red-400">{pushErr}</p>}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionEncryption')}</h2>
            <div className="space-y-4 rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div>
                <div className="text-sm font-medium text-slate-200">{t('settings.encTitle')}</div>
                <div className="mt-1 text-xs text-slate-400">{t('settings.encDesc')}</div>
              </div>

              {!encEnrolled ? (
                <button
                  type="button"
                  onClick={setUpEncryption}
                  disabled={encBusy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {encBusy ? t('settings.encWorking') : t('settings.encSetUp')}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <span>🔒</span> {t('settings.encActive')}
                  </div>
                  {encFingerprint && (
                    <div>
                      <div className="text-xs text-slate-400">{t('settings.encFingerprint')}</div>
                      <code className="mt-1 block break-all rounded bg-slate-900 p-2 text-[11px] leading-relaxed text-slate-300">
                        {encFingerprint}
                      </code>
                    </div>
                  )}
                  <div className="border-t border-slate-900 pt-3">
                    <div className="text-sm font-medium text-slate-200">
                      {encHasBackup ? t('settings.encBackupOnTitle') : t('settings.encBackupTitle')}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{t('settings.encBackupDesc')}</div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="password"
                        value={encPass}
                        onChange={(e) => setEncPass(e.target.value)}
                        placeholder={t('settings.encPassPlaceholder')}
                        className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={saveBackupNow}
                        disabled={encBusy}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {t('settings.encBackupSave')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showRestore && (
                <div className="border-t border-slate-900 pt-3">
                  <div className="text-sm font-medium text-slate-200">{t('settings.encRestoreTitle')}</div>
                  <div className="mt-1 text-xs text-slate-400">{t('settings.encRestoreDesc')}</div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      value={encPass}
                      onChange={(e) => setEncPass(e.target.value)}
                      placeholder={t('settings.encPassPlaceholder')}
                      className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={restoreNow}
                      disabled={encBusy}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {t('settings.encRestore')}
                    </button>
                  </div>
                </div>
              )}

              {encMsg && <p className="text-xs text-slate-300">{encMsg}</p>}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">{t('settings.sectionLegal')}</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm text-sm">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <Link href="/privacy" className="text-blue-400 hover:text-blue-300">{t('settings.privacyPolicy')}</Link>
                <span className="text-slate-600">·</span>
                <Link href="/terms" className="text-blue-400 hover:text-blue-300">{t('settings.termsOfService')}</Link>
                <span className="text-slate-600">·</span>
                <Link href="/guidelines" className="text-blue-400 hover:text-blue-300">{t('settings.communityGuidelines')}</Link>
                <span className="text-slate-600">·</span>
                <Link href="/support" className="text-blue-400 hover:text-blue-300">{t('settings.support')}</Link>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-500 ml-1">{t('settings.sectionDangerZone')}</h2>
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">{t('settings.deleteAccountTitle')}</div>
              <div className="mt-1 text-xs text-slate-400">
                {t('settings.deleteAccountDesc')}
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
              >
                {t('settings.deleteAccountButton')}
              </button>
            </div>
          </section>

          <div className="pt-4 border-t border-slate-900">
            <button
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              onClick={signOut}
            >
              {t('settings.signOut')}
            </button>
            {status && <p className="text-xs text-center mt-3 text-slate-500 italic">{status}</p>}
          </div>
        </div>
      )}

      {user && (
        <AvatarCreator
          open={avatarCreatorOpen}
          userId={user.id}
          onClose={() => setAvatarCreatorOpen(false)}
          onSaved={(url) => {
            setAvatarUrl(url);
            setStatus(`✅ ${t('settings.photoUpdated')}`);
          }}
        />
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) {
              setDeleteOpen(false);
              setDeleteConfirm('');
              setDeleteErr('');
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-rose-900/50 bg-slate-950 p-4 shadow-xl">
            <div className="text-base font-semibold text-rose-400">{t('settings.deleteAccountTitle')}</div>
            <p className="mt-2 text-sm text-slate-300">
              <TransBold text={t('settings.deleteModalPrompt')} />
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={t('settings.deleteModalPlaceholder')}
              className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
            {deleteErr && <p className="mt-2 text-xs text-red-400">{deleteErr}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm('');
                  setDeleteErr('');
                }}
                disabled={deleteBusy}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {t('settings.deleteModalCancel')}
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleteBusy || deleteConfirm !== 'DELETE'}
                className="flex-1 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {deleteBusy ? t('settings.deleting') : t('settings.deleteModalConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
