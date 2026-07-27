// Vibrant, deterministic styling for fallback avatars (users/groups with no
// photo). One source of truth so these look lively and consistent everywhere,
// instead of a flat grey block or a muted auto-gradient.

// Curated high-energy duotones — no greys, so every fallback pops.
const PALETTE: readonly (readonly [string, string])[] = [
  ['#6366f1', '#a855f7'], // indigo → purple
  ['#0ea5e9', '#22d3ee'], // sky → cyan
  ['#f43f5e', '#fb923c'], // rose → orange
  ['#10b981', '#84cc16'], // emerald → lime
  ['#db2777', '#7c3aed'], // pink → violet
  ['#f59e0b', '#ef4444'], // amber → red
  ['#ec4899', '#8b5cf6'], // fuchsia → violet
  ['#06b6d4', '#3b82f6'], // cyan → blue
  ['#22c55e', '#14b8a6'], // green → teal
  ['#8b5cf6', '#ec4899'], // violet → pink
  ['#2f66ff', '#12a150'], // brand blue → green
  ['#f97316', '#facc15'], // orange → yellow
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A glossy, deterministic background for `seed`: a soft top-left sheen over a
 * vibrant diagonal gradient. Assign to CSS `background-image`.
 */
export function avatarBg(seed: string | null | undefined): string {
  const [a, b] = PALETTE[hash(seed || '?') % PALETTE.length];
  return (
    `radial-gradient(circle at 30% 22%, rgba(255,255,255,.42), rgba(255,255,255,0) 56%),` +
    `linear-gradient(140deg, ${a}, ${b})`
  );
}

/** 1–2 uppercase initials from a display name ("María López" → "ML"). */
export function initials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
