'use client';

import { useEffect, useMemo, useState } from 'react';

type Action = {
  key: string;
  label: string;
  icon: string; // emoji/icon simple
  tone?: 'normal' | 'danger';
  onClick: () => void;
};

type Mode = 'main' | 'more';

export function MessageActionsSheet(props: {
  open: boolean;
  title?: string;
  onClose: () => void;
  actions: Action[];
  moreActions?: Action[];
}) {
  const { open, onClose, actions, moreActions, title } = props;

  const [mode, setMode] = useState<Mode>('main');

  useEffect(() => {
    if (!open) return;
    setMode('main');

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const showMoreButton = !!moreActions?.length;

  const header = useMemo(() => {
    if (mode === 'main') return { title: 'Message', subtitle: title };
    return { title: 'More', subtitle: title };
  }, [mode, title]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-2 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 p-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">{header.title}</div>
            {header.subtitle ? <div className="truncate text-xs text-slate-400">{header.subtitle}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            {mode === 'more' ? (
              <button
                className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
                onClick={() => setMode('main')}
                type="button"
                title="Back"
              >
                ← Back
              </button>
            ) : null}

            <button
              className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-3">
          {mode === 'main' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={[
                      'flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-2 text-sm hover:bg-slate-900',
                      a.tone === 'danger' ? 'text-red-300' : 'text-slate-100',
                    ].join(' ')}
                    onClick={() => {
                      a.onClick();
                      onClose();
                    }}
                  >
                    <span className="text-base">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>

              {showMoreButton ? (
                <div className="mt-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 hover:bg-slate-900"
                    onClick={() => setMode('more')}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">…</span>
                      <span>More</span>
                    </span>
                    <span className="text-slate-400">→</span>
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(moreActions ?? []).map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={[
                      'flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-2 text-sm hover:bg-slate-900',
                      a.tone === 'danger' ? 'text-red-300' : 'text-slate-100',
                    ].join(' ')}
                    onClick={() => {
                      a.onClick();
                      onClose();
                    }}
                  >
                    <span className="text-base">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          className="w-full rounded-b-2xl border-t border-slate-900 bg-slate-950 py-3 text-sm text-slate-300 hover:bg-slate-900"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
