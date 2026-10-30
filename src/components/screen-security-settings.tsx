'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { isScreenSecurityOn, setScreenSecurity, canScreenSecurity } from '@/lib/native-screen-security';

/** Settings toggle for screenshot/screen-recording protection (Android). */
export function ScreenSecuritySettings() {
  const t = useT();
  const [on, setOn] = useState(isScreenSecurityOn);
  const supported = canScreenSecurity();

  function toggle() {
    const next = !on;
    setOn(next);
    void setScreenSecurity(next);
  }

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-200">{t('screenSecurity.title')}</div>
          <div className="mt-1 text-xs text-slate-400">{t('screenSecurity.desc')}</div>
        </div>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={on}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-600' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {!supported && <div className="mt-2 text-[11px] text-slate-500">{t('screenSecurity.androidOnly')}</div>}
    </div>
  );
}
