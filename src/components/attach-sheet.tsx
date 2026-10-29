'use client';

import { useEffect, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/context';
import { useBackClose } from '@/lib/back';
import { ImageIcon, FilmIcon, CameraIcon, VideoIcon, GifIcon, BarChartIcon, PaperclipIcon } from '@/components/icons';

export function AttachSheet(props: {
  open: boolean;
  onClose: () => void;
  onPickPhotos: () => void;
  onPickVideo: () => void;
  onCameraPhoto: () => void;
  onCameraVideo: () => void;
  onPickFile: () => void;
  onPoll: () => void;
  onGif: () => void;
  onSticker?: () => void;
  onContact?: () => void;
  onLocation?: () => void;
  onSchedule?: () => void;
}) {
  const { open, onClose, onPickPhotos, onPickVideo, onCameraPhoto, onCameraVideo, onPickFile, onPoll, onGif, onSticker, onContact, onLocation, onSchedule } = props;
  useBackClose(open, onClose);
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

  const Btn = (p: { icon: ReactNode; label: string; onClick: () => void }) => (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-slate-900 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 hover:bg-slate-900"
      onClick={() => {
        p.onClick();
        onClose();
      }}
    >
      <span className="flex items-center gap-3">
        <span className="text-slate-300">{p.icon}</span>
        <span>{p.label}</span>
      </span>
      <span className="text-slate-400">→</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 backdrop-blur-sm p-2 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-800 toky-glass toky-elev"
        onClick={(e) => e.stopPropagation()}
      >
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
          <Btn icon={<ImageIcon size={18} />} label={t('attach.photoLibrary')} onClick={onPickPhotos} />
          <Btn icon={<FilmIcon size={18} />} label={t('attach.videoLibrary')} onClick={onPickVideo} />

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
                <CameraIcon size={18} /> {t('attach.photo')}
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 hover:bg-slate-900"
                onClick={() => {
                  onCameraVideo();
                  onClose();
                }}
              >
                <VideoIcon size={18} /> {t('attach.video')}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {t('attach.desktopNote')}
            </div>
          </div>

          <Btn icon={<GifIcon size={18} />} label={t('attach.gif')} onClick={onGif} />
          {onSticker && (
            <Btn
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8l6-6V5a2 2 0 0 0-2-2z" />
                  <path d="M14 21v-5a1 1 0 0 1 1-1h5" />
                </svg>
              }
              label={t('attach.sticker')}
              onClick={onSticker}
            />
          )}
          <Btn icon={<BarChartIcon size={18} />} label={t('attach.poll')} onClick={onPoll} />
          {onContact && (
            <Btn
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
              label={t('attach.contact')}
              onClick={onContact}
            />
          )}
          {onLocation && (
            <Btn
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
              label={t('attach.location')}
              onClick={onLocation}
            />
          )}
          <Btn icon={<PaperclipIcon size={18} />} label={t('attach.file')} onClick={onPickFile} />
          {onSchedule && (
            <Btn
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              }
              label={t('schedule.title')}
              onClick={onSchedule}
            />
          )}
        </div>

        <button
          type="button"
          className="w-full rounded-b-3xl border-t border-slate-800/70 py-3 text-sm text-slate-300 hover:bg-slate-800/40"
          onClick={onClose}
        >
          {t('attach.cancel')}
        </button>
      </div>
    </div>
  );
}
