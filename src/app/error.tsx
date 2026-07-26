'use client';

/**
 * Route-level error boundary for the app tree.
 *
 * Next.js renders this (inside the root layout) whenever a Server or Client
 * Component in a route throws during rendering. It keeps a single broken screen
 * from taking down the whole app: the user sees a friendly, bilingual recovery
 * card with a "try again" button (which re-renders the segment) instead of a
 * blank page. Root-layout failures are handled separately by global-error.tsx.
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for logs / future error reporting.
    console.error('App error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-2xl">
          ⚠️
        </div>
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="mt-1 text-sm text-slate-400">Something went wrong</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          Ocurrió un error inesperado. Puedes intentar de nuevo.
          <br />
          <span className="text-slate-500">An unexpected error occurred. You can try again.</span>
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="toky-grad toky-ring-brand w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          >
            Reintentar · Try again
          </button>
          <a
            href="/"
            className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Ir al inicio · Go home
          </a>
        </div>

        {error?.digest ? (
          <p className="mt-5 select-all text-[11px] text-slate-600">Ref: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
