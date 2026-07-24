'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useT, useLanguage } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { LEGAL } from '@/lib/legal';
import { hasAcceptedCurrentLegal, recordLegalAcceptance } from '@/lib/db/legal';

// Device-side record of which document versions were accepted, so the gate also
// works before sign-in and re-appears when a version changes.
const KEY = 'toky_consent_v1';
const CURRENT = `${LEGAL.termsVersion}|${LEGAL.privacyVersion}`;
const MIN_AGE = String(LEGAL.minAge);

function deviceAccepted(): boolean {
  try {
    return localStorage.getItem(KEY) === CURRENT;
  } catch {
    return false;
  }
}

/**
 * Age + Terms/Privacy gate. Blocks the app until the user confirms they meet the
 * minimum age and accept the current Terms and Privacy Policy. Acceptance is
 * stored per-device AND, once signed in, in Supabase (public.legal_acceptances)
 * with the document versions — so bumping a version in LEGAL re-prompts the user
 * and records a fresh acceptance.
 */
export function ConsentGate() {
  const t = useT();
  const { lang } = useLanguage();
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(true); // assume accepted until we check
  const pathname = usePathname();

  useEffect(() => {
    const supabase = browserSupabase();
    let cancelled = false;

    async function evaluate() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        // Pre-login: rely on the device record only.
        if (!cancelled) {
          setAccepted(deviceAccepted());
          setReady(true);
        }
        return;
      }
      // Signed in: the server ledger is the source of truth.
      const inDb = await hasAcceptedCurrentLegal(user.id);
      if (inDb) {
        if (!cancelled) { setAccepted(true); setReady(true); }
        return;
      }
      // Accepted on this device but not yet recorded (e.g. right after sign-up)
      // — record it silently instead of prompting again.
      if (deviceAccepted()) {
        await recordLegalAcceptance(user.id, lang).catch(() => {});
        if (!cancelled) { setAccepted(true); setReady(true); }
        return;
      }
      if (!cancelled) { setAccepted(false); setReady(true); }
    }

    void evaluate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void evaluate());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [lang]);

  // Never gate the policy pages themselves (the user needs to read them here).
  const isPolicyPage = ['/privacy', '/terms', '/guidelines', '/support', '/delete-account'].includes(
    pathname
  );

  if (!ready || accepted || isPolicyPage) return null;

  async function accept() {
    try {
      localStorage.setItem(KEY, CURRENT);
    } catch {
      // ignore
    }
    try {
      const { data } = await browserSupabase().auth.getUser();
      if (data.user) await recordLegalAcceptance(data.user.id, lang);
    } catch {
      // best effort — device record still blocks re-prompting
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
