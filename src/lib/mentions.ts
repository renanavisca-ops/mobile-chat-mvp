// @mention parsing shared by the composer, the renderer and the push route.
// A mention is "@" + a username, right after the start of the text or a space/
// opening paren — so it never matches the "@" inside an email address.

export const MENTION_RE = /(^|[\s(])@([a-zA-Z0-9._]{1,32})/g;

/** Lowercased usernames mentioned in the text, in order (may repeat). */
export function extractMentionUsernames(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(MENTION_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[2].toLowerCase());
  return out;
}

/** Distinct user ids mentioned, resolved against a username→id map. */
export function extractMentionIds(
  text: string,
  usernameToId: Map<string, string>,
  excludeId?: string,
): string[] {
  const ids = new Set<string>();
  for (const u of extractMentionUsernames(text)) {
    const id = usernameToId.get(u);
    if (id && id !== excludeId) ids.add(id);
  }
  return [...ids];
}
