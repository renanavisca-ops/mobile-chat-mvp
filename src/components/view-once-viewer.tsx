'use client';

import { useEffect } from 'react';
import { XIcon } from '@/components/icons';
import { useT } from '@/lib/i18n/context';
import { useBackClose } from '@/lib/back';

/**
 * Full-screen one-time ("ver una vez") viewer for a photo or video. Unlike the
 * regular lightbox it offers no save/share/download — the media is meant to be
 * seen once and then locked. Tap the backdrop or ✕ to close; the caller records
 * the view and relocks the bubble when this closes.
 */
export function ViewOnceViewer({
  url,
  kind,
  onClose,
}: {
  url: string;
  kind: 'photo' | 'video';
  onClose: () => void;
}) {
  const t = useT();
  useBackClose(true, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/95 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-3 pt-safe">
        <span className="m-3 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          <EyeOnceGlyph />
          {t('viewOnce.badge')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="m-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
          aria-label={t('common.close')}
        >
          <XIcon size={22} />
        </button>
      </div>

      {kind === 'video' ? (
        <video
          src={url}
          autoPlay
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          className="max-h-[92vh] max-w-[96vw] select-none rounded-lg object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          className="max-h-[92vh] max-w-[96vw] select-none rounded-lg object-contain"
        />
      )}
    </div>
  );
}

function EyeOnceGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v3l2 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
