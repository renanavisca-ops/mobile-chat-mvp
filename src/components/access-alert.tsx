'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT, useFormatters } from '@/lib/i18n/context';
import { listNewLogins, acknowledgeLogins, type NewLogin } from '@/lib/db/devices';

/**
 * New-login access alert (§1). Shows a dismissible banner when the account has
 * a recent sign-in on another device that hasn't been acknowledged. "OK" clears
 * it for the account; a link goes to device management to revoke if it wasn't
 * the user.
 */
export function AccessAlert() {
  const t = useT();
  const fmts = useFormatters();
  const [logins, setLogins] = useState<NewLogin[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    listNewLogins().then(setLogins).catch(() => {});
  }, []);

  if (dismissed || logins.length === 0) return null;
  const latest = logins[0];

  async function ack() {
    setDismissed(true);
    try { await acknowledgeLogins(logins.map((l) => l.id)); } catch { /* best-effort */ }
  }

  return (
    <div className="mb-2 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
      <div className="font-medium">🔐 {t('accessAlert.title')}</div>
      <div className="mt-0.5 text-xs text-amber-200/80">
        {t('accessAlert.body', { device: latest.label || t('accessAlert.unknownDevice'), when: fmts.dateTime(new Date(latest.createdAt)) })}
        {logins.length > 1 ? ` (+${logins.length - 1})` : ''}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={ack} className="rounded-lg bg-amber-800/60 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-800">
          {t('accessAlert.wasMe')}
        </button>
        <Link href="/settings" onClick={ack} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
          {t('accessAlert.review')}
        </Link>
      </div>
    </div>
  );
}
