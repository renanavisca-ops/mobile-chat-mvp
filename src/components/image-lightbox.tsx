'use client';

import { useEffect, useRef, useState } from 'react';
import { XIcon, DownloadIcon, ExternalLinkIcon } from '@/components/icons';
import { canNativeFiles, shareNativeFile } from '@/lib/native-files';

/**
 * Full-screen image viewer with pinch-to-zoom, drag-to-pan and double-tap zoom.
 * Tap the backdrop or ✕ to close (only when not zoomed). Closes on Escape and
 * locks body scroll while open. Gestures are handled manually via pointer
 * events so they work inside the app's WebView (where native page pinch-zoom is
 * disabled).
 */
const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function ImageLightbox({
  url,
  alt = '',
  onClose,
}: {
  url: string;
  alt?: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Live gesture bookkeeping (refs so pointer handlers see fresh values).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number; tx: number; ty: number; mx: number; my: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

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

  function center() {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { cx: 0, cy: 0, w: 0, h: 0 };
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
  }

  // Keep the image from being dragged entirely off-screen.
  function clamp(nx: number, ny: number, s: number) {
    const { w, h } = center();
    const maxX = (w * (s - 1)) / 2;
    const maxY = (h * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  }

  // Zoom to `nextScale` around a focal point (used by double-tap).
  function applyScale(nextScale: number, focalX: number, focalY: number) {
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    const { cx, cy } = center();
    const mx = focalX - cx;
    const my = focalY - cy;
    const c = clamp(mx - (mx - tx) * (s / scale), my - (my - ty) * (s / scale), s);
    setScale(s);
    setTx(c.x);
    setTy(c.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        tx,
        ty,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
      };
      panStart.current = null;
    } else if (pointers.current.size === 1 && scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ps = pinchStart.current;
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ps.scale * (dist / ps.dist)));
      const { cx, cy } = center();
      const mx = ps.mx - cx;
      const my = ps.my - cy;
      const nx = mx - (mx - ps.tx) * (s / ps.scale);
      const ny = my - (my - ps.ty) * (s / ps.scale);
      const c = clamp(nx, ny, s);
      moved.current = true;
      setScale(s);
      setTx(c.x);
      setTy(c.y);
    } else if (pointers.current.size === 1 && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      const c = clamp(panStart.current.tx + dx, panStart.current.ty + dy, scale);
      setTx(c.x);
      setTy(c.y);
    }
  }

  function reset() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      // Snap back if we drifted under 1× (rubber-band feel).
      if (scale <= 1.01) reset();
      // Double-tap toggles zoom (only when it wasn't a drag/pinch).
      if (!moved.current) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          if (scale > 1) reset();
          else applyScale(2.5, e.clientX, e.clientY);
        } else {
          lastTap.current = now;
        }
      }
    }
  }

  async function share() {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const name = `image.${((blob.type.split('/')[1] || 'jpg').split(';')[0]) || 'jpg'}`;
      if (canNativeFiles()) {
        await shareNativeFile(blob, name);
        return;
      }
      const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
      const nav = navigator as Navigator & { canShare?: (d?: any) => boolean };
      if (nav.canShare?.({ files: [file] }) && typeof navigator.share === 'function') {
        await navigator.share({ files: [file] });
        return;
      }
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = name;
      a.click();
      setTimeout(() => { try { URL.revokeObjectURL(u); } catch {} }, 4000);
    } catch {
      /* user cancelled or fetch failed — no-op */
    }
  }

  const zoomed = scale > 1;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/90 backdrop-blur-sm"
      onClick={(e) => {
        // Close on a plain backdrop tap only when not zoomed.
        if (e.target === e.currentTarget && !zoomed && !moved.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute right-3 top-3 z-10 flex gap-2 pt-safe">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); share(); }}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
          aria-label="Share image"
        >
          <ExternalLinkIcon size={20} />
        </button>
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
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          touchAction: 'none',
          transition: pinchStart.current || panStart.current ? 'none' : 'transform 0.15s ease-out',
          cursor: zoomed ? 'grab' : 'zoom-in',
        }}
        className="max-h-[92vh] max-w-[96vw] select-none rounded-lg object-contain"
      />
    </div>
  );
}
