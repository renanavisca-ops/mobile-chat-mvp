'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const KEY = 'toky_consent_v1';
const MIN_AGE = '13'; // adjust to your jurisdiction (e.g. 16 in parts of the EU)

/**
 * First-run age + terms gate. Blocks the app until the user confirms they meet
 * the minimum age and accepts the Terms and Privacy Policy. Stored per-device.
 * This is a baseline gate; enforce age at sign-up server-side for real assurance.
 */
export function ConsentGate() {
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
  const isPolicyPage = pathname === '/privacy' || pathname === '/terms';

  if (!ready || accepted || isPolicyPage) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, 'true');
    } catch {
      // ignore
    }
    setAccepted(true);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-200 shadow-xl">
        <div className="text-lg font-semibold">Welcome to Toky Chat</div>
        <p className="mt-3 text-sm text-slate-400">
          You must be at least {MIN_AGE} years old to use Toky Chat. By continuing you
          confirm your age and agree to our{' '}
          <a href="/terms" className="text-blue-400 underline hover:text-blue-300">Terms</a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-400 underline hover:text-blue-300">Privacy Policy</a>.
        </p>
        <button
          type="button"
          onClick={accept}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          I&apos;m {MIN_AGE} or older — I agree
        </button>
      </div>
    </div>
  );
}
