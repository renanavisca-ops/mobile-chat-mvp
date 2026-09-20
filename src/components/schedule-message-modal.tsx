'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import {
  addScheduled,
  listScheduledForChat,
  removeScheduled,
  type ScheduledMessage,
} from '@/lib/scheduled-messages';
import { XIcon } from '@/components/icons';

/** Local time formatted for a datetime-local input (yyyy-MM-ddThh:mm). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleMessageModal({
  open,
  onClose,
  chatId,
  chatLabel,
}: {
  open: boolean;
  onClose: () => void;
  chatId: string;
  chatLabel: string;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [pending, setPending] = useState<ScheduledMessage[]>([]);

  useEffect(() => {
    if (!open) return;
    setText('');
    setError('');
    // Default the picker to 1 hour from now.
    setWhen(toLocalInput(new Date(Date.now() + 3600e3)));
    browserSupabase().auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setMyId(uid);
      if (uid) setPending(listScheduledForChat(uid, chatId));
    }).catch(() => {});
  }, [open, chatId]);

  if (!open) return null;

  function schedule() {
    setError('');
    const body = text.trim();
    if (!body) return;
    const at = new Date(when).getTime();
    if (!at || at <= Date.now()) {
      setError(t('schedule.pastError'));
      return;
    }
    if (!myId) return;
    addScheduled(myId, { chatId, chatLabel, text: body, at });
    setPending(listScheduledForChat(myId, chatId));
    setText('');
  }

  function cancel(id: string) {
    if (!myId) return;
    removeScheduled(myId, id);
    setPending(listScheduledForChat(myId, chatId));
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-3xl border border-slate-800 toky-glass toky-elev p-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">{t('schedule.title')}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="ml-1 block text-xs text-slate-400">{t('schedule.messageLabel')}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={t('schedule.messagePlaceholder')}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="ml-1 block text-xs text-slate-400">{t('schedule.timeLabel')}</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={schedule}
            disabled={!text.trim()}
            className="w-full rounded-xl toky-grad toky-ring-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t('schedule.add')}
          </button>
          <p className="text-[11px] text-slate-500">{t('schedule.note')}</p>
        </div>

        <div className="mt-5 border-t border-slate-900 pt-3">
          <div className="ml-1 text-xs text-slate-400">{t('schedule.pending')} ({pending.length})</div>
          {pending.length === 0 ? (
            <p className="mt-2 px-1 text-xs text-slate-500">{t('schedule.empty')}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {pending.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-950/60 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">{s.text}</span>
                    <span className="block text-xs text-slate-500">{new Date(s.at).toLocaleString()}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cancel(s.id)}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    {t('schedule.cancel')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
