'use client';

import { useEffect } from 'react';
import { useT } from '@/lib/i18n/context';

export function AttachSheet(props: {
  open: boolean;
  onClose: () => void;
  onPickPhotos: () => void;
  onPickVideo: () => void;
  onCameraPhoto: () => void;
  onCameraVideo: () => void;
  onPickFile: () => void;
  onPoll: () => void;
}) {
  const { open, onClose, onPickPhotos, onPickVideo, onCameraPhoto, onCameraVideo, onPickFile, onPoll } = props;
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const Btn = (p: { icon: string; label: string; onClick: () => void }) => (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-slate-900 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 hover:bg-slate-900"
      onClick={() => {
        p.onClick();
        onClose();
      }}
    >
      <span className="flex items-center gap-3">
        <span className="text-base">{p.icon}</span>
        <span>{p.label}</span>
      </span>
      <span className="text-slate-400">→</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 p-2 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-900 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">{t('attach.title')}</div>
            <div className="text-xs text-slate-400">{t('attach.subtitle')}</div>
          </div>
          <button
            className="rounded bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
            onClick={onClose}
            type="button"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="space-y-2 p-3">
          <Btn icon="🖼️" label={t('attach.photoLibrary')} onClick={onPickPhotos} />
          <Btn icon="🎥" label={t('attach.videoLibrary')} onClick={onPickVideo} />

          <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-2">
            <div className="mb-2 text-xs text-slate-400">{t('attach.camera')}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 hover:bg-slate-900"
                onClick={() => {
                  onCameraPhoto();
                  onClose();
                }}
              >
                📸 {t('attach.photo')}
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 hover:bg-slate-900"
                onClick={() => {
                  onCameraVideo();
                  onClose();
                }}
              >
                🎬 {t('attach.video')}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {t('attach.desktopNote')}
            </div>
          </div>

          <Btn icon="📊" label={t('attach.poll')} onClick={onPoll} />
          <Btn icon="📎" label={t('attach.file')} onClick={onPickFile} />
        </div>

        <button
          type="button"
          className="w-full rounded-b-2xl border-t border-slate-900 bg-slate-950 py-3 text-sm text-slate-300 hover:bg-slate-900"
          onClick={onClose}
        >
          {t('attach.cancel')}
        </button>
      </div>
    </div>
  );
}
