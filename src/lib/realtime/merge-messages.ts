import type { MessageRow } from '@/lib/db/types';

// Reconcile a fresh latest-page fetch onto what we have in memory. As well as
// de-duping by id and dropping optimistic `local-` echoes once the real row
// (same plaintext) arrives, this reconciles changes we may have missed while
// offline/asleep:
//   - the fetched page is authoritative for its time window, so a server row
//     that falls inside that window but is no longer returned was deleted,
//     expired (disappearing) or removed — we drop it;
//   - rows older than the window are left untouched (outside the page's
//     authority), and pending local echoes are always kept.
// Edits are handled for free: a changed row keeps its id, so the fetched copy
// overwrites the stale one.
export function mergeMessages(prev: MessageRow[], rows: MessageRow[]): MessageRow[] {
  // An empty fetch is ambiguous (transient failure vs truly empty), so never
  // nuke what we have from it.
  if (rows.length === 0) return prev;

  const fetchedIds = new Set(rows.map((r) => r.id));
  const windowStart = rows.reduce(
    (min, r) => Math.min(min, new Date(r.created_at).getTime()),
    Infinity,
  );

  const map = new Map<string, MessageRow>();
  for (const m of prev) {
    const isLocal = String(m.id).startsWith('local-');
    const insideWindow = new Date(m.created_at).getTime() >= windowStart;
    // Drop a server row inside the authoritative window that the fetch no
    // longer returns (deleted/expired while we were away). Keep local echoes
    // and anything older than the window.
    if (!isLocal && insideWindow && !fetchedIds.has(m.id)) continue;
    map.set(m.id, m);
  }
  for (const r of rows) map.set(r.id, r);

  const realCiphertexts = new Set(rows.map((r) => r.ciphertext ?? ''));
  const merged = Array.from(map.values()).filter(
    (m) => !(String(m.id).startsWith('local-') && realCiphertexts.has(m.ciphertext ?? ''))
  );
  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return merged;
}
