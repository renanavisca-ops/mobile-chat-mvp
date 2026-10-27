'use client';

import React from 'react';

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
 */
export function Linkify({ text, className }: { text: string; className?: string }) {
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
    if (trail) nodes.push(trail);
    last = start + match.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <>{nodes}</>;
}
