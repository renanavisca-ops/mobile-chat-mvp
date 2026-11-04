/**
 * Channel recommendations (§8). A lightweight, on-device heuristic — no backend
 * and no new data: given the public channels already fetched for discovery
 * (each flagged joined + category), suggest ones the user hasn't joined,
 * prioritizing categories they already follow, then newest first (the input is
 * expected newest-first, as listPublicChannels returns it).
 */

export type RecommendInput = { id: string; category: string | null; joined: boolean };

export function recommendChannels<T extends RecommendInput>(channels: T[], limit = 5): T[] {
  const followedCategories = new Set(
    channels.filter((c) => c.joined && c.category).map((c) => c.category as string),
  );
  const notJoined = channels.filter((c) => !c.joined);
  // Stable partition: same-category-as-followed first, keeping input order.
  const preferred = notJoined.filter((c) => c.category && followedCategories.has(c.category));
  const rest = notJoined.filter((c) => !(c.category && followedCategories.has(c.category)));
  return [...preferred, ...rest].slice(0, Math.max(0, limit));
}
