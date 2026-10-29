'use client';

import React from 'react';
import { Linkify } from '@/components/linkify';
import { MENTION_RE } from '@/lib/mentions';

type MentionInfo = { name: string; me: boolean };

/**
 * Render message text with @mentions highlighted and URLs made tappable.
 * Only usernames that belong to a known member are treated as mentions (shown
 * as "@DisplayName"); the viewer's own mention gets a stronger highlight.
 * Non-mention text is passed through Linkify, so links still work.
 */
export function MessageText({
  text,
  mentions,
}: {
  text: string;
  mentions?: Map<string, MentionInfo>;
}) {
  if (!mentions || mentions.size === 0) return <Linkify text={text} />;

  const nodes: React.ReactNode[] = [];
  const re = new RegExp(MENTION_RE);
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const uname = m[2].toLowerCase();
    const info = mentions.get(uname);
    if (!info) continue; // "@something" that isn't a member — leave as plain text
    const atIndex = m.index + m[1].length; // position of '@' (skip the boundary char)
    if (atIndex > last) nodes.push(<Linkify key={key++} text={text.slice(last, atIndex)} />);
    nodes.push(
      <span
        key={key++}
        className={
          info.me
            ? 'rounded bg-amber-400/25 px-0.5 font-semibold text-amber-200'
            : 'font-semibold text-blue-300'
        }
      >
        @{info.name}
      </span>,
    );
    last = atIndex + 1 + m[2].length; // past '@' + username
  }
  if (last < text.length) nodes.push(<Linkify key={key++} text={text.slice(last)} />);

  return <>{nodes}</>;
}
