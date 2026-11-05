'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { getMyPhone, requestPhoneCode, verifyPhoneCode } from '@/lib/db/phone';

/**
 * Optional phone verification for the signed-in account (§1). Adds a verified
 * phone as an attribute — it never replaces email login. Disabled by default;
 * the request/verify endpoints return 501 unless the feature is configured, in
 * which case this shows a notice. With the local simulator the code is shown so
 * the flow completes without SMS (see docs/PHONE.md).
 */
export function PhoneSettings() {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [verified, setVerified] = useState(false);
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'code'>('idle');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getMyPhone().then((p) => { setPhone(p.phone ?? ''); setVerified(p.verified); }).catch(() => {});
  }, []);

  async function onRequest() {
    setBusy(true); setStatus('');
    try {
      const r = await requestPhoneCode(draft);
      if (!r.ok) {
        setStatus(r.code === 'phone_taken' ? `❌ ${t('phone.taken')}`
          : r.code === 'invalid_phone' ? `❌ ${t('phone.invalid')}`
          : `ℹ️ ${t('phone.disabled')}`);
      } else {
        setStage('code');
        setStatus(r.simulatedCode ? `🧪 ${t('phone.simCode', { code: r.simulatedCode })}` : `✅ ${t('phone.sent')}`);
      }
    } catch { setStatus(`❌ ${t('phone.error')}`); } finally { setBusy(false); }
  }

  async function onVerify() {
    setBusy(true); setStatus('');
    try {
      const r = await verifyPhoneCode(code);
      if (!r.ok) {
        setStatus(`❌ ${t('phone.wrong')}`);
      } else {
        setPhone(r.phone); setVerified(true); setStage('idle'); setDraft(''); setCode('');
        setStatus(`✅ ${t('phone.verified')}`);
      }
    } catch { setStatus(`❌ ${t('phone.error')}`); } finally { setBusy(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4">
      <div className="text-sm font-semibold text-slate-100">{t('phone.title')}</div>
      <div className="mt-0.5 text-xs text-slate-400">{t('phone.desc')}</div>

      {verified && phone ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-200">
          <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">✓ {t('phone.verifiedBadge')}</span>
          <span>{phone}</span>
        </div>
      ) : stage === 'idle' ? (
        <div className="mt-3 flex gap-2">
          <input className={inputCls} inputMode="tel" placeholder={t('phone.placeholder')} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" onClick={onRequest} disabled={busy || !draft.trim()} className="shrink-0 rounded-lg toky-grad px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('phone.sendCode')}</button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input className={inputCls} inputMode="numeric" maxLength={6} placeholder={t('phone.codePlaceholder')} value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="button" onClick={onVerify} disabled={busy || code.length !== 6} className="shrink-0 rounded-lg toky-grad px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t('phone.verify')}</button>
        </div>
      )}

      {status && <p className="mt-2 text-xs text-slate-300">{status}</p>}
    </div>
  );
}
