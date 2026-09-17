'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';

/**
 * Inline PDF renderer backed by PDF.js.
 *
 * An `<iframe src="blob:…">` of a PDF renders fine in a desktop browser but is
 * BLANK inside the Android System WebView, which ships no built-in PDF plugin —
 * so tapping a PDF used to fall through to the share sheet ("forward") instead
 * of previewing. PDF.js paints each page onto a `<canvas>`, which every WebView
 * can draw, so the preview works natively too. It's pure client-side JS loaded
 * from the web, so it needs no native/AAB change.
 *
 * The worker ships as a same-origin static file (`/public/pdf.worker.min.js`,
 * copied from the pinned `pdfjs-dist`), which is the most robust setup for the
 * static mobile export and the WebView (no cross-origin/CSP worker issues, and
 * the worker version always matches the pinned library).
 */
export function PdfCanvas({ blob, fileName }: { blob: Blob; fileName?: string }) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => void } | null = null;

    setLoading(true);
    setError(false);

    (async () => {
      try {
        const mod: any = await import('pdfjs-dist/legacy/build/pdf');
        const pdfjs: any = mod.getDocument ? mod : mod.default;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

        const data = await blob.arrayBuffer();
        if (cancelled) return;

        pdfDoc = await pdfjs.getDocument({ data }).promise;
        if (cancelled || !pdfDoc) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        // Width available for a page (container minus its horizontal padding).
        const cs = getComputedStyle(container);
        const padX = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
        const availWidth = Math.max(180, container.clientWidth - padX);
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

        for (let n = 1; n <= pdfDoc.numPages; n += 1) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = availWidth / base.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = '12px';
          canvas.style.borderRadius = '8px';
          canvas.style.background = '#fff';
          ctx.scale(dpr, dpr);

          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        pdfDoc?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [blob]);

  if (error) {
    return (
      <div className="flex h-40 w-full max-w-md items-center justify-center rounded-2xl bg-white/10 text-sm text-red-300">
        {t('chat.previewFailed')}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-full max-w-md animate-pulse rounded-2xl bg-white/10" />
        </div>
      ) : null}
      <div
        ref={containerRef}
        aria-label={fileName}
        className="h-full w-full overflow-auto px-1"
      />
    </div>
  );
}
