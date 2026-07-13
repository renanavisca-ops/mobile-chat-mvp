'use client';

import { useState } from 'react';
import { submitReport } from '@/lib/db/safety';

const REASONS = [
  'Harassment or bullying',
  'Spam',
  'Impersonation',
  'Sexual or exploitative content',
  'Violence or dangerous behavior',
  'Other',
];

export function ReportModal({
  open,
  onClose,
  reportedUserId,
  chatId,
  messageId,
}: {
  open: boolean;
  onClose: () => void;
  reportedUserId?: string | null;
  chatId?: string | null;
  messageId?: string | null;
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  function reset() {
    setReason('');
    setDetails('');
    setDone(false);
    setErr('');
  }

  async function submit() {
    if (!reason) {
      setErr('Choose a reason.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await submitReport({ reportedUserId, chatId, messageId, reason, details });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          reset();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
        <div className="text-base font-semibold text-slate-100">Report</div>

        {done ? (
          <>
            <p className="mt-3 text-sm text-slate-300">
              Thanks — your report was submitted and our team will review it.
            </p>
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="mt-4 w-full rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-950/60 p-2 text-sm text-slate-200"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {r}
                </label>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={3}
              className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />

            {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
