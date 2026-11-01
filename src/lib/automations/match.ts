// Pure keyword-matching for automation rules. No I/O, no crypto: it only looks
// at text that is already plain (support-chat customer messages). Kept
// dependency-free so it can be unit-tested and reused on client or server.

export type MatchType = 'contains' | 'equals' | 'starts_with';

export type RuleMatchSpec = {
  matchType: MatchType;
  keywords: string[];
  caseSensitive: boolean;
};

/** True if `text` satisfies the rule (any keyword matches per matchType). */
export function ruleMatches(text: string, rule: RuleMatchSpec): boolean {
  if (!text) return false;
  const hay = rule.caseSensitive ? text : text.toLowerCase();
  for (const raw of rule.keywords) {
    const kw = (rule.caseSensitive ? raw : raw.toLowerCase()).trim();
    if (!kw) continue;
    if (rule.matchType === 'equals' && hay.trim() === kw) return true;
    if (rule.matchType === 'starts_with' && hay.trimStart().startsWith(kw)) return true;
    if (rule.matchType === 'contains' && hay.includes(kw)) return true;
  }
  return false;
}

/** The enabled rules that match the text, preserving input order. */
export function matchingRules<T extends RuleMatchSpec & { enabled?: boolean }>(
  text: string,
  rules: T[],
): T[] {
  if (!text || !text.trim()) return [];
  return rules.filter((r) => r.enabled !== false && ruleMatches(text, r));
}
