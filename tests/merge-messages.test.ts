import { describe, expect, it } from 'vitest';
import { mergeMessages } from '@/lib/realtime/merge-messages';
import type { MessageRow } from '@/lib/db/types';

function msg(id: string, iso: string, extra: Partial<MessageRow> = {}): MessageRow {
  return {
    id,
    chat_id: 'c1',
    message_type: 'whisper',
    created_at: iso,
    ciphertext: `ct-${id}`,
    ...extra,
  } as MessageRow;
}

const T = (n: number) => new Date(2026, 0, 1, 0, 0, n).toISOString();

describe('mergeMessages reconnection reconciliation', () => {
  it('adds new fetched rows and sorts by time', () => {
    const prev = [msg('a', T(1))];
    const rows = [msg('a', T(1)), msg('b', T(2))];
    const out = mergeMessages(prev, rows);
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('drops a message deleted on the server while away (inside the fetch window)', () => {
    // 'b' is in memory but the authoritative fetch (window starts at 'a') no
    // longer returns it → it was deleted/expired.
    const prev = [msg('a', T(1)), msg('b', T(2)), msg('c', T(3))];
    const rows = [msg('a', T(1)), msg('c', T(3))];
    const out = mergeMessages(prev, rows);
    expect(out.map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('keeps messages older than the fetch window (outside its authority)', () => {
    const prev = [msg('old', T(0)), msg('b', T(2))];
    const rows = [msg('b', T(2)), msg('c', T(3))];
    const out = mergeMessages(prev, rows);
    expect(out.map((m) => m.id)).toEqual(['old', 'b', 'c']);
  });

  it('applies edits: the fetched copy overwrites the stale one', () => {
    const prev = [msg('a', T(1), { content: 'old' })];
    const rows = [msg('a', T(1), { content: 'new', edited_at: T(5) })];
    const out = mergeMessages(prev, rows);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe('new');
  });

  it('keeps a pending local echo until its real row arrives, then dedupes it', () => {
    const local = msg('local-1', T(2), { ciphertext: 'ct-real' });
    // Not yet sent: fetch does not contain it → kept.
    expect(mergeMessages([local], [msg('a', T(1))]).some((m) => m.id === 'local-1')).toBe(true);
    // Real row with same ciphertext arrives → echo dropped, real kept.
    const real = msg('r1', T(2), { ciphertext: 'ct-real' });
    const out = mergeMessages([local], [msg('a', T(1)), real]);
    expect(out.map((m) => m.id)).toEqual(['a', 'r1']);
  });

  it('never nukes memory on an empty (possibly transient) fetch', () => {
    const prev = [msg('a', T(1))];
    expect(mergeMessages(prev, [])).toEqual(prev);
  });
});
