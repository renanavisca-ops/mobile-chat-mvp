'use client';

import { useEffect } from 'react';

type Action = {
  key: string;
  label: string;
  icon: string; // emoji/icon simple (no dependencias)
  tone?: 'normal' | 'danger';
  onClick: () => void;
};

export function MessageActionsSheet(props: {
  open: boolean;
  title?: string;
  onClose: () => void;
  actions: Action[];
  moreActions?: Action[];
}) {
  const { open, onClose, actions, moreActions, title } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-2 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 p-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">Message</div>
            {title ? <div className="truncate text-xs text-slate-400">{title}</div> : null}
          </div>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="p-3">
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

          {moreActions?.length ? (
            <div className="mt-3 rounded-xl border border-slate-900 bg-slate-950/40 p-2">
              <div className="mb-2 text-xs text-slate-400">More</div>
              <div className="grid grid-cols-2 gap-2">
                {moreActions.map((a) => (
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
            </div>
          ) : null}
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
