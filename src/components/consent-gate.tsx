'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

const KEY = 'toky_consent_v1';
const MIN_AGE = '13'; // adjust to your jurisdiction (e.g. 16 in parts of the EU)

/**
 * First-run age + terms gate. Blocks the app until the user confirms they meet
 * the minimum age and accepts the Terms and Privacy Policy. Stored per-device.
 * This is a baseline gate; enforce age at sign-up server-side for real assurance.
 */
export function ConsentGate() {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(true); // assume accepted until we check
  const pathname = usePathname();

  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(KEY) === 'true');
    } catch {
      setAccepted(true);
    }
    setReady(true);
  }, []);

  // Never gate the policy pages themselves (the user needs to read them here).
  const isPolicyPage = ['/privacy', '/terms', '/guidelines', '/support', '/delete-account'].includes(
    pathname
  );

  if (!ready || accepted || isPolicyPage) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, 'true');
    } catch {
      // ignore
    }
    setAccepted(true);
  }

  // {{terms}} / {{privacy}} are left as literal placeholders (only {{age}} is
  // filled) so we can split the string and inject real <a> links in their place.
  const noticeParts = t('consent.notice', { age: MIN_AGE }).split(/\{\{terms\}\}|\{\{privacy\}\}/);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-200 shadow-xl">
        <div className="text-lg font-semibold">{t('consent.welcome')}</div>
        <p className="mt-3 text-sm text-slate-400">
          {noticeParts[0]}
          <a href="/terms" className="text-blue-400 underline hover:text-blue-300">{t('consent.termsLink')}</a>
          {noticeParts[1]}
          <a href="/privacy" className="text-blue-400 underline hover:text-blue-300">{t('consent.privacyLink')}</a>
          {noticeParts[2]}
        </p>
        <button
          type="button"
          onClick={accept}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          {t('consent.agree', { age: MIN_AGE })}
        </button>
      </div>
    </div>
  );
}
