import { describe, it, expect } from 'vitest';
import { recommendChannels } from '../src/lib/channels/recommend';

const ch = (id: string, category: string | null, joined: boolean) => ({ id, category, joined });

describe('recommendChannels', () => {
  it('excludes channels already joined', () => {
    const out = recommendChannels([ch('a', 'news', true), ch('b', 'tech', false)]);
    expect(out.map((c) => c.id)).toEqual(['b']);
  });

  it('prioritizes categories the user already follows, keeping input order', () => {
    const out = recommendChannels([
      ch('joined-tech', 'tech', true),
      ch('x-news', 'news', false),
      ch('y-tech', 'tech', false),
      ch('z-tech', 'tech', false),
    ]);
    expect(out.map((c) => c.id)).toEqual(['y-tech', 'z-tech', 'x-news']);
  });

  it('respects the limit', () => {
    const all = Array.from({ length: 10 }, (_, i) => ch(`c${i}`, null, false));
    expect(recommendChannels(all, 3)).toHaveLength(3);
  });

  it('returns empty when everything is joined', () => {
    expect(recommendChannels([ch('a', 'news', true)])).toEqual([]);
  });
});
