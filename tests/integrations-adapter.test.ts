import { describe, it, expect } from 'vitest';
import { pickAdapter, deliverLocal } from '../src/lib/integrations/adapter';

describe('pickAdapter', () => {
  it('is disabled unless enabled with a target', () => {
    expect(pickAdapter(false, 'local')).toBe('disabled');
    expect(pickAdapter(true, '')).toBe('disabled');
  });
  it('selects the local adapter', () => {
    expect(pickAdapter(true, 'local')).toBe('local');
  });
  it('reports any other target as unimplemented (no pretend delivery)', () => {
    expect(pickAdapter(true, 'crm')).toBe('unimplemented');
    expect(pickAdapter(true, 'https://hooks.example.com/x')).toBe('unimplemented');
  });
});

describe('deliverLocal', () => {
  it('acknowledges every event id', () => {
    const out = deliverLocal([{ id: 1, type: 'a', data: {} }, { id: 2, type: 'b', data: {} }]);
    expect(out.deliveredIds).toEqual([1, 2]);
  });
  it('handles an empty batch', () => {
    expect(deliverLocal([]).deliveredIds).toEqual([]);
  });
});
