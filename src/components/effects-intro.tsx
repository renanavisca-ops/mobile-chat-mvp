'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme';
import { useT } from '@/lib/i18n/context';
import { MessageEffects } from '@/components/message-effects';

/**
 * One-time suggestion for the festive message effects. Appears once (until the
 * user responds), lets them PREVIEW an example (fireworks), and keep them on or
 * turn them off — so the effects are opt-outable without being a surprise.
 * Shown from the chats home. Skipped entirely under prefers-reduced-motion.
 */
export function EffectsIntro() {
  const { effectsIntroSeen, setEffects, setEffectsIntroSeen } = useTheme();
  const t = useT();
  const [show, setShow] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (effectsIntroSeen) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setEffectsIntroSeen(true);
      return;
    }
    // Small delay so prefs have loaded and the card doesn't fight first paint.
    const id = window.setTimeout(() => setShow(true), 1400);
    return () => window.clearTimeout(id);
  }, [effectsIntroSeen, setEffectsIntroSeen]);

  if (!show) return null;

  const enable = () => {
    setEffects(true);
    setEffectsIntroSeen(true);
    setShow(false);
  };
  const disable = () => {
    setEffects(false);
    setEffectsIntroSeen(true);
    setShow(false);
  };

  return (
    <>
      <MessageEffects trigger={preview} onDone={() => setPreview(null)} />
      <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 pb-safe">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">🎆</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-100">{t('effectsIntro.title')}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('effectsIntro.body')}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreview('fireworks')}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
            >
              {t('effectsIntro.preview')}
            </button>
            <button
              type="button"
              onClick={enable}
              className="toky-grad rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            >
              {t('effectsIntro.enable')}
            </button>
            <button
              type="button"
              onClick={disable}
              className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              {t('effectsIntro.disable')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
