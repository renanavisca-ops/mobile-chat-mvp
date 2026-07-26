'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { myFingerprint, peerFingerprint } from '@/lib/crypto/keystore';

/**
 * Signal-style safety-number screen. Shows this device's identity fingerprint
 * alongside the contact's so two people can confirm out-of-band that no one is
 * intercepting their end-to-end-encrypted chat. "Mark as verified" is a local
 * trust note (per chat) — it never leaves the device.
 */
export function SafetyNumberModal({
  open,
  onClose,
  chatId,
  peerName,
  peerUserId,
}: {
  open: boolean;
  onClose: () => void;
  chatId: string;
  peerName: string;
  peerUserId: string | null;
}) {
  const t = useT();
  const [mine, setMine] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVerified((() => {
      try { return localStorage.getItem(`toky:verified:${chatId}`) === '1'; } catch { return false; }
    })());
    let alive = true;
    setLoading(true);
    (async () => {
      const [a, b] = await Promise.all([
        myFingerprint(),
        peerUserId ? peerFingerprint(peerUserId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setMine(a);
      setTheirs(b);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, chatId, peerUserId]);

  if (!open) return null;

  function toggleVerified() {
    setVerified((v) => {
      const next = !v;
      try { localStorage.setItem(`toky:verified:${chatId}`, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="toky-glass toky-elev w-full max-w-md rounded-t-3xl border border-slate-800 p-5 pb-safe sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-3">
          <span className="toky-grad grid h-10 w-10 place-items-center rounded-2xl text-white">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold">{t('safety.title')}</h2>
            <p className="truncate text-xs text-slate-400">{t('safety.subtitle')}</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            <div className="toky-skeleton h-24 rounded-2xl" />
            <div className="toky-skeleton h-24 rounded-2xl" />
          </div>
        ) : mine && theirs ? (
          <>
            <FingerprintBlock label={t('safety.theirKey').replace('{name}', peerName)} value={theirs} />
            <FingerprintBlock label={t('safety.yourKey')} value={mine} />
            <p className="mt-4 text-xs leading-relaxed text-slate-400">{t('safety.hint')}</p>
            <button
              type="button"
              onClick={toggleVerified}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                verified ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40' : 'toky-grad text-white'
              }`}
            >
              {verified ? `✓ ${t('safety.verified')}` : t('safety.markVerified')}
            </button>
          </>
        ) : (
          <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
            {t('safety.unavailable')}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl border border-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/40"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

function FingerprintBlock({ label, value }: { label: string; value: string }) {
  const groups = value.split(' ').filter(Boolean);
  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="grid grid-cols-4 gap-x-3 gap-y-1 font-mono text-[13px] tracking-wider text-slate-100">
        {groups.map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </div>
    </div>
  );
}
