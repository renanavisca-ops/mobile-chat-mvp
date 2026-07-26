'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { browserSupabase } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/context';

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useT();
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
      setStatus({ type: 'error', message: t('resetPassword.errorTooShort') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: t('resetPassword.errorMismatch') });
      return;
    }

    setBusy(true);
    try {
      const supabase = browserSupabase();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setStatus({ type: 'success', message: t('resetPassword.updated') });

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || t('resetPassword.errorUpdate') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title={t('resetPassword.title')}>
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-6 shadow-lg">
          <p className="text-sm text-slate-400 mb-6">
            {t('resetPassword.intro')}
          </p>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm text-slate-300 ml-1">{t('resetPassword.newPassword')}</label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-slate-300 ml-1">{t('resetPassword.confirmPassword')}</label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
              className="toky-grad toky-ring-brand w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? t('resetPassword.updating') : t('resetPassword.changePassword')}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
