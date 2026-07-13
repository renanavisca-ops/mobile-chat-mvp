'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';
import { WALLPAPERS, getWallpaperId, setWallpaperId as saveWallpaperId } from '@/lib/wallpaper';
import { uploadAvatar } from '@/lib/db/avatar';
import { useNotifications } from '@/lib/hooks/useNotifications';

export default function SettingsPage() {
  const supabase = browserSupabase();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [showOnline, setShowOnline] = useState<boolean>(true);
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
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { permission, requestPermission } = useNotifications();

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
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (e: any) {
      setDeleteErr(e?.message ?? String(e));
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    setActiveDeviceId(localStorage.getItem('active_device_id'));
    setWpId(getWallpaperId());
  }, []);

  function chooseWallpaper(id: string) {
    saveWallpaperId(id);
    setWpId(id);
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
      setStatus('✅ Perfil actualizado');
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
      setStatus('✅ Foto actualizada');
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
            setProfile({ username: 'Usuario', role: 'agent' });
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
            username: 'Usuario',
            role: 'agent'
          };
          setProfile(prof);
          setShowOnline((prof as any)?.show_online ?? true);
          setDisplayName((prof as any)?.display_name ?? '');
          setAvatarUrl((prof as any)?.avatar_url ?? null);
        }

      } catch (e) {
        console.error('Unexpected error:', e);

        if (mounted) {
          setProfile({
            username: 'Usuario',
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
    setStatus('✅ Signed out');
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

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus({ type: null, message: '' });

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Las contraseñas no coinciden' });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordStatus({ type: 'success', message: 'Contraseña actualizada' });
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.message || 'Error al actualizar la contraseña' });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <PageShell title="Settings">
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-slate-300 animate-pulse">Cargando...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Cuenta</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">Email</div>
              <div className="text-xs text-slate-400 mt-1">{user?.email ?? user?.id ?? 'No disponible'}</div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Dispositivo</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">ID de dispositivo activo</div>
              <div className="text-xs text-slate-400 mt-1">{activeDeviceId ?? '(ninguno) — ejecuta /onboarding'}</div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Perfil</h2>
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
                <div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarBusy}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {avatarBusy ? 'Subiendo…' : 'Cambiar foto'}
                  </button>
                  <input ref={avatarInputRef} type="file" hidden accept="image/*" onChange={onAvatarChange} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 block text-xs text-slate-400">Nombre a mostrar</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  placeholder={profile?.username ?? 'Tu nombre'}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <div className="ml-1 text-xs text-slate-500">Username: {profile?.username ?? '(sin username)'}</div>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {savingProfile ? 'Guardando…' : 'Guardar perfil'}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Fondo de chat</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">Elige un fondo para tus chats</div>
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
              </div>
              <div className="mt-2 text-xs text-slate-500">Se guarda en este dispositivo.</div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Privacidad</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-200">Mostrar mi estado en línea</div>
                <div className="text-xs text-slate-400 mt-1">
                  Si lo desactivas, los demás no verán cuándo estás conectado.
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
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Seguridad</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 block ml-1">Contraseña actual (opcional)</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 block ml-1">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 block ml-1">Confirmar nueva contraseña</label>
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
                  {isUpdating ? 'Actualizando...' : 'Cambiar contraseña'}
                </button>
              </form>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Notificaciones</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-200">Notificaciones del navegador</div>
                <div className="text-xs text-slate-400 mt-1">
                  {permission === 'granted'
                    ? 'Activadas.'
                    : permission === 'denied'
                    ? 'Bloqueadas — habilítalas en los ajustes del navegador.'
                    : 'Recibe un aviso cuando llega un mensaje nuevo.'}
                </div>
              </div>
              {permission !== 'granted' && (
                <button
                  type="button"
                  onClick={() => requestPermission()}
                  disabled={permission === 'denied'}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Activar
                </button>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Legal</h2>
            <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm text-sm">
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Política de privacidad</Link>
              <span className="mx-2 text-slate-600">·</span>
              <Link href="/terms" className="text-blue-400 hover:text-blue-300">Términos de servicio</Link>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-500 ml-1">Zona de peligro</h2>
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-200">Eliminar cuenta</div>
              <div className="mt-1 text-xs text-slate-400">
                Elimina tu perfil, dispositivos y contactos de forma permanente. Los
                mensajes que enviaste se mantienen visibles para las otras personas del
                chat. Esta acción no se puede deshacer.
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
              >
                Eliminar mi cuenta
              </button>
            </div>
          </section>

          <div className="pt-4 border-t border-slate-900">
            <button
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              onClick={signOut}
            >
              Cerrar sesión
            </button>
            {status && <p className="text-xs text-center mt-3 text-slate-500 italic">{status}</p>}
          </div>
        </div>
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
            <div className="text-base font-semibold text-rose-400">Eliminar cuenta</div>
            <p className="mt-2 text-sm text-slate-300">
              Esta acción es permanente. Escribe <b>DELETE</b> para confirmar.
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
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
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleteBusy || deleteConfirm !== 'DELETE'}
                className="flex-1 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {deleteBusy ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
