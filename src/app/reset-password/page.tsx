'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: null, message: '' });

    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Las contraseñas no coinciden' });
      return;
    }

    setBusy(true);
    try {
      const supabase = browserSupabase();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setStatus({ type: 'success', message: 'Contraseña actualizada' });

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error al actualizar la contraseña' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Recuperar contraseña">
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-6 shadow-lg">
          <p className="text-sm text-slate-400 mb-6">
            Ingresa tu nueva contraseña para acceder a tu cuenta.
          </p>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm text-slate-300 ml-1">Nueva contraseña</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-slate-300 ml-1">Confirmar contraseña</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {status.message && (
              <div className={`text-xs p-3 rounded-lg border ${status.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                {status.type === 'success' ? '✅ ' : '❌ '}
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {busy ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
