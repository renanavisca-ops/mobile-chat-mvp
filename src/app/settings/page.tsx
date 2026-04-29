'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';

export default function SettingsPage() {
  const supabase = browserSupabase();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setActiveDeviceId(localStorage.getItem('active_device_id'));
  }, []);

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
    </PageShell>
  );
}
