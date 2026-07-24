'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n/context';

/**
 * Shared shell for the legal/support pages. Renders the document in the app's
 * current language (English or Spanish) with a toggle so either version is
 * always reachable — satisfying the requirement that every policy be available
 * in both languages. Content is passed in for each language.
 */
export function LegalDoc({ en, es }: { en: ReactNode; es: ReactNode }) {
  const { lang } = useLanguage();
  const [override, setOverride] = useState<'en' | 'es' | null>(null);
  const active = override ?? (lang === 'es' ? 'es' : 'en');

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-200">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          ← {active === 'es' ? 'Volver a la app' : 'Back to app'}
        </Link>
        <div className="text-xs" role="group" aria-label="Language">
          <button
            type="button"
            onClick={() => setOverride('en')}
            className={active === 'en' ? 'font-semibold text-slate-100' : 'text-slate-400 hover:text-slate-200'}
          >
            English
          </button>
          <span className="mx-1.5 text-slate-600">·</span>
          <button
            type="button"
            onClick={() => setOverride('es')}
            className={active === 'es' ? 'font-semibold text-slate-100' : 'text-slate-400 hover:text-slate-200'}
          >
            Español
          </button>
        </div>
      </div>
      <div className="mt-4">{active === 'es' ? es : en}</div>
    </main>
  );
}
