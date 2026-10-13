import type { ReactNode } from 'react';

/**
 * Build a short preview around the FIRST match of `q` in `text`, with the
 * matched part wrapped in <mark> so it stands out. Collapses whitespace so a
 * multi-line message renders as one tidy line. Used by both the global search
 * (chat list) and the in-chat search so matches are highlighted the same way.
 */
export function highlightSnippet(text: string | null | undefined, q: string): ReactNode {
  const s = (text || '').replace(/\s+/g, ' ').trim();
  const query = (q || '').trim();
  if (!s) return '';
  const idx = query ? s.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx < 0) return s.length > 120 ? `${s.slice(0, 120)}…` : s;
  const start = Math.max(0, idx - 24);
  const pre = (start > 0 ? '…' : '') + s.slice(start, idx);
  const match = s.slice(idx, idx + query.length);
  const postEnd = idx + query.length + 80;
  const post = s.slice(idx + query.length, postEnd) + (s.length > postEnd ? '…' : '');
  return (
    <>
      {pre}
      <mark className="rounded bg-amber-400/25 px-0.5 text-amber-200">{match}</mark>
      {post}
    </>
  );
}
