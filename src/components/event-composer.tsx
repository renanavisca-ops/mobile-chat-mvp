'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/context';

export type NewEvent = { title: string; startsAt: string; location?: string; note?: string };

/** Default the date/time picker to the next round hour. */
function defaultLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  // datetime-local wants local YYYY-MM-DDTHH:mm (no timezone/seconds).
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventComposer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (ev: NewEvent) => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(defaultLocal);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  function reset() {
    setTitle('');
    setWhen(defaultLocal());
    setLocation('');
    setNote('');
    setErr('');
  }

  async function submit() {
    if (!title.trim()) { setErr(t('event.needTitle')); return; }
    const d = new Date(when);
    if (isNaN(d.getTime())) { setErr(t('event.needDate')); return; }
    setBusy(true);
    setErr('');
    try {
      await onCreate({
        title: title.trim(),
        startsAt: d.toISOString(),
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      });
      reset();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) { reset(); onClose(); } }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 toky-glass toky-elev p-4">
        <div className="text-base font-semibold text-slate-100">{t('event.createTitle')}</div>

        <label className="mt-3 block text-xs text-slate-400">{t('event.titleLabel')}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('event.titlePlaceholder')} maxLength={120} className={`mt-1 ${field}`} />

        <label className="mt-3 block text-xs text-slate-400">{t('event.whenLabel')}</label>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`mt-1 ${field}`} />

        <label className="mt-3 block text-xs text-slate-400">{t('event.locationLabel')}</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('event.locationPlaceholder')} maxLength={160} className={`mt-1 ${field}`} />

        <label className="mt-3 block text-xs text-slate-400">{t('event.noteLabel')}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('event.notePlaceholder')} maxLength={500} rows={2} className={`mt-1 resize-none ${field}`} />

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => { reset(); onClose(); }} disabled={busy} className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={busy} className="flex-1 toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? t('event.creating') : t('event.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
