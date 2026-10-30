'use client';

import React, { useState } from 'react';
import { useT } from '@/lib/i18n/context';
import { assessLink } from '@/lib/link-safety';

// Same URL shape the link-preview detector uses. Global flag so we can walk
// every URL in the text, not just the first.
const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

/**
 * Render message text with any http(s) URLs turned into tappable links.
 *
 * Plain text in a bubble is never treated as a link by the WebView, so a
 * pasted URL (e.g. a Play Store update link in the news channel) couldn't be
 * opened or copied cleanly. Real <a> elements fix both: Capacitor opens an
 * external URL in the system browser, and users can long-press to copy it.
 *
 * Links that look deceptive (embedded credentials, punycode, raw IP) are shown
 * with a warning and open only after the user confirms in an interstitial.
 */
export function Linkify({ text, className }: { text: string; className?: string }) {
  const t = useT();
  const [confirm, setConfirm] = useState<{ url: string; reasonKey?: string } | null>(null);

  const nodes: React.ReactNode[] = [];
  const re = new RegExp(URL_RE); // fresh instance: the global regex is stateful
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const match = m[0];
    const start = m.index;
    if (start > last) nodes.push(text.slice(last, start));

    // Trailing sentence punctuation usually isn't part of the link.
    let href = match;
    let trail = '';
    const tm = href.match(/[.,;:!?]+$/);
    if (tm) {
      trail = tm[0];
      href = href.slice(0, -trail.length);
    }

    const risk = assessLink(href);

    if (risk.risky) {
      const safeHref = href;
      nodes.push(
        <a
          key={key++}
          href={safeHref}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm({ url: safeHref, reasonKey: risk.reasonKey }); }}
          className="font-medium text-amber-300 underline decoration-dotted underline-offset-2 break-all"
          title={t('linkSafety.warnBadge')}
        >
          ⚠ {safeHref}
        </a>,
      );
    } else {
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={className ?? 'font-medium underline underline-offset-2 break-all'}
        >
          {href}
        </a>,
      );
    }
    if (trail) nodes.push(trail);
    last = start + match.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <>
      {nodes}
      {confirm && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setConfirm(null); }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-amber-500/40 toky-glass toky-elev p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-300">
              <span className="text-lg">⚠</span>
              <h2 className="text-base font-semibold">{t('linkSafety.title')}</h2>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {t(`linkSafety.reason_${confirm.reasonKey ?? 'generic'}`)}
            </p>
            <div className="mt-3 break-all rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-[12px] text-slate-200">
              {confirm.url}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = confirm.url;
                  setConfirm(null);
                  try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
                }}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
              >
                {t('linkSafety.openAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
