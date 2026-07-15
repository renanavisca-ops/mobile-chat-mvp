'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/context';

/**
 * Lightweight, dependency-free video trimmer. It does NOT re-encode the file —
 * it records a start/end range (in seconds) that the player honours, so a long
 * clip can be sent but viewers only see the selected portion. True file-level
 * trimming/compression (to shrink the upload) would need ffmpeg.wasm.
 */
export function VideoTrimmer({
  open,
  fileUrl,
  onClose,
  onApply,
}: {
  open: boolean;
  fileUrl: string | null;
  onClose: () => void;
  onApply: (start: number, end: number) => void;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  useEffect(() => {
    if (!open) return;
    setDuration(0);
    setStart(0);
    setEnd(0);
  }, [open, fileUrl]);

  function onLoaded() {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    setDuration(v.duration);
    setEnd(v.duration);
  }

  // Keep playback inside the selected window.
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime < start) v.currentTime = start;
    if (v.currentTime >= end) {
      v.currentTime = start;
      v.pause();
    }
  }

  function seekTo(sec: number) {
    const v = videoRef.current;
    if (v) v.currentTime = sec;
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  if (!open || !fileUrl) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-3">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 p-3">
          <div className="text-sm font-semibold text-slate-100">{t('videoTrim.title')}</div>
          <button type="button" onClick={onClose} className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700">
            {t('common.close')}
          </button>
        </div>

        <div className="bg-black/30 p-3">
          <video
            ref={videoRef}
            src={fileUrl}
            controls
            onLoadedMetadata={onLoaded}
            onTimeUpdate={onTimeUpdate}
            className="mx-auto max-h-[45vh] w-auto rounded-lg border border-slate-800"
          />
        </div>

        <div className="space-y-4 border-t border-slate-900 p-4">
          {duration > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t('videoTrim.start')}: {fmt(start)}</span>
                <span>{t('videoTrim.selected')}: {fmt(Math.max(0, end - start))}</span>
                <span>{t('videoTrim.end')}: {fmt(end)}</span>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">{t('videoTrim.start')}</label>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={start}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), end - 0.5);
                    setStart(v);
                    seekTo(v);
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500">{t('videoTrim.end')}</label>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={end}
                  onChange={(e) => {
                    const v = Math.max(Number(e.target.value), start + 0.5);
                    setEnd(v);
                    seekTo(v);
                  }}
                  className="w-full"
                />
              </div>

              <p className="text-[11px] text-slate-500">{t('videoTrim.note')}</p>
            </>
          ) : (
            <p className="text-center text-sm text-slate-500">{t('common.loading')}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => onApply(start, end)}
              disabled={duration === 0}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {t('videoTrim.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Video player that honours an optional [start,end] trim window. */
export function TrimmedVideo({
  src,
  start,
  end,
  className,
  onError,
  onCanPlay,
}: {
  src: string;
  start?: number;
  end?: number;
  className?: string;
  onError?: () => void;
  onCanPlay?: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const hasTrim = typeof start === 'number' && typeof end === 'number' && end > start;

  return (
    <video
      ref={ref}
      src={src}
      controls
      className={className}
      onError={onError}
      onCanPlay={onCanPlay}
      onLoadedMetadata={() => {
        if (hasTrim && ref.current) ref.current.currentTime = start!;
      }}
      onTimeUpdate={() => {
        if (!hasTrim || !ref.current) return;
        const v = ref.current;
        if (v.currentTime < start!) v.currentTime = start!;
        if (v.currentTime >= end!) {
          v.currentTime = start!;
          v.pause();
        }
      }}
    />
  );
}
