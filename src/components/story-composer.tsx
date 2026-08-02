'use client';

import { useEffect, useRef, useState } from 'react';
import { createImageStory, createTextStory } from '@/lib/db/stories';
import { useT } from '@/lib/i18n/context';
import { ImageIcon, TypeIcon, PencilIcon, XIcon, PlusIcon } from '@/components/icons';
import { ImageEditor } from '@/components/image-editor';

const BACKGROUNDS = [
  'linear-gradient(135deg,#6366f1,#a855f7)',
  'linear-gradient(135deg,#0ea5e9,#22d3ee)',
  'linear-gradient(135deg,#f43f5e,#f59e0b)',
  'linear-gradient(135deg,#10b981,#84cc16)',
  'linear-gradient(135deg,#1e293b,#475569)',
  'linear-gradient(135deg,#db2777,#7c3aed)',
];

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ITEMS = 10;

type Mode = 'choose' | 'text' | 'review';

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
  // Selected images awaiting review/edit before posting.
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Build (and revoke) object URLs for the review thumbnails.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      for (const u of urls) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    };
  }, [files]);

  if (!open) return null;

  function reset() {
    setMode('choose');
    setText('');
    setBg(BACKGROUNDS[0]);
    setErr('');
    setFiles([]);
    setEditingIndex(null);
    setProgress(null);
  }

  function close() {
    reset();
    onClose();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;
    const valid = picked.filter((f) => ACCEPTED.includes(f.type));
    if (valid.length === 0) {
      setErr(t('chat.onlyJpgPngWebp'));
      return;
    }
    setErr('');
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_ITEMS));
    setMode('review');
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onEditSave(file: File) {
    setFiles((prev) => prev.map((f, idx) => (idx === editingIndex ? file : f)));
    setEditingIndex(null);
  }

  async function postImages() {
    if (files.length === 0) return;
    setBusy(true);
    setErr('');
    const total = files.length;
    const remaining: File[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ done: i, total });
      try {
        await createImageStory(files[i]);
      } catch {
        remaining.push(files[i]);
      }
    }
    setProgress(null);
    setBusy(false);
    onPosted();
    if (remaining.length > 0) {
      setFiles(remaining);
      setErr(t('stories.someFailed', { n: remaining.length }));
    } else {
      close();
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

  const reviewing = mode === 'review' && files.length > 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 toky-glass toky-elev p-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-100">
            {reviewing ? t('stories.reviewTitle') : t('stories.addTitle')}
          </div>
          <button type="button" onClick={close} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

        {/* Shared file input — supports selecting several images at once. */}
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChange}
        />

        {reviewing ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-400">{t('stories.selectedCount', { n: files.length })}</p>
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={src} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setEditingIndex(i)}
                    disabled={busy}
                    aria-label={t('stories.edit')}
                    className="absolute bottom-1 left-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 disabled:opacity-50"
                  >
                    <PencilIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    disabled={busy}
                    aria-label={t('stories.remove')}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 disabled:opacity-50"
                  >
                    <XIcon size={14} />
                  </button>
                </div>
              ))}
              {files.length < MAX_ITEMS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  aria-label={t('stories.addMore')}
                  className="grid aspect-square place-items-center rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-slate-400 hover:bg-slate-900 disabled:opacity-50"
                >
                  <PlusIcon size={22} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setFiles([]); setMode('choose'); }}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={postImages}
                disabled={busy || files.length === 0}
                className="flex-1 toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {progress
                  ? t('stories.postingProgress', { done: progress.done, total: progress.total })
                  : t('stories.postCount', { n: files.length })}
              </button>
            </div>
          </div>
        ) : mode === 'choose' ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-6 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            >
              <ImageIcon size={26} />
              {t('stories.photo')}
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              disabled={busy}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-6 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            >
              <TypeIcon size={26} />
              {t('stories.text')}
            </button>
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
                className="flex-1 toky-grad toky-ring-brand rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? t('stories.posting') : t('stories.post')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Per-image editor (crop / rotate / draw / filter) reused from chat. */}
      <ImageEditor
        open={editingIndex !== null}
        file={editingIndex !== null ? files[editingIndex] ?? null : null}
        onClose={() => setEditingIndex(null)}
        onSave={onEditSave}
      />
    </div>
  );
}
