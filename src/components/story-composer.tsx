'use client';

import { useRef, useState } from 'react';
import { createImageStory, createTextStory } from '@/lib/db/stories';
import { useT } from '@/lib/i18n/context';

const BACKGROUNDS = [
  'linear-gradient(135deg,#6366f1,#a855f7)',
  'linear-gradient(135deg,#0ea5e9,#22d3ee)',
  'linear-gradient(135deg,#f43f5e,#f59e0b)',
  'linear-gradient(135deg,#10b981,#84cc16)',
  'linear-gradient(135deg,#1e293b,#475569)',
  'linear-gradient(135deg,#db2777,#7c3aed)',
];

type Mode = 'choose' | 'text';

export function StoryComposer({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>('choose');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open) return null;

  function reset() {
    setMode('choose');
    setText('');
    setBg(BACKGROUNDS[0]);
    setErr('');
  }

  function close() {
    reset();
    onClose();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      await createImageStory(file);
      onPosted();
      close();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function postText() {
    setBusy(true);
    setErr('');
    try {
      await createTextStory(text, bg);
      onPosted();
      close();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-900 bg-slate-950 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">{t('stories.addTitle')}</div>
          <button type="button" onClick={close} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        {mode === 'choose' ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-6 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            >
              <span className="text-2xl">🖼️</span>
              {t('stories.photo')}
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              disabled={busy}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-6 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            >
              <span className="text-2xl">🅰️</span>
              {t('stories.text')}
            </button>
            <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={onFileChange} />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div
              className="grid min-h-[160px] place-items-center rounded-xl p-4 text-center text-lg font-semibold text-white"
              style={{ background: bg }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder={t('stories.textPlaceholder')}
                className="w-full resize-none border-0 bg-transparent text-center text-lg font-semibold text-white placeholder:text-white/70 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBg(b)}
                  aria-label={t('stories.background')}
                  className={`h-8 w-8 rounded-full border-2 ${bg === b ? 'border-white' : 'border-transparent'}`}
                  style={{ background: b }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={postText}
                disabled={busy || !text.trim()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? t('stories.posting') : t('stories.post')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
