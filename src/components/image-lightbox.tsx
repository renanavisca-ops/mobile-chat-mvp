'use client';

import { useEffect, useState } from 'react';
import { XIcon, DownloadIcon } from '@/components/icons';

/**
 * Full-screen image viewer. Tap the backdrop or ✕ to close; tap the image to
 * toggle a 2× zoom. Closes on Escape and locks body scroll while open.
 */
export function ImageLightbox({
  url,
  alt = '',
  onClose,
}: {
  url: string;
  alt?: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);

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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute right-3 top-3 z-10 flex gap-2 pt-safe">
        <a
          href={url}
          download
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
          aria-label="Download image"
        >
          <DownloadIcon size={20} />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
          aria-label="Close"
        >
          <XIcon size={22} />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((z) => !z);
        }}
        className={`max-h-[92vh] max-w-[96vw] select-none rounded-lg object-contain transition-transform duration-200 ${
          zoomed ? 'scale-[1.8] cursor-zoom-out' : 'cursor-zoom-in'
        }`}
      />
    </div>
  );
}
