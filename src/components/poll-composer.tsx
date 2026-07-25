'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/context';

export function PollComposer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => Promise<void>;
}) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  function reset() {
    setQuestion('');
    setOptions(['', '']);
    setErr('');
  }

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) {
      setErr(t('poll.needQuestionAndOptions'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await onCreate(question.trim(), cleanOptions);
      reset();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          reset();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 toky-glass toky-elev p-4">
        <div className="text-base font-semibold text-slate-100">{t('poll.createTitle')}</div>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('poll.questionPlaceholder')}
          maxLength={200}
          className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />

        <div className="mt-3 space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={t('poll.optionPlaceholder', { n: String(i + 1) })}
                maxLength={80}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-900 hover:text-slate-300"
                  aria-label={t('common.remove')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 8 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300"
          >
            + {t('poll.addOption')}
          </button>
        )}

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex-1 toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? t('poll.creating') : t('poll.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
