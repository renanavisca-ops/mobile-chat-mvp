import { describe, it, expect } from 'vitest';
import { selectBatch, simulateDelivery } from '../src/lib/campaigns/sender';

const r = (id: string) => ({ customerId: id });

describe('selectBatch', () => {
  it('returns everyone when there is no daily limit', () => {
    expect(selectBatch([r('a'), r('b'), r('c')], 0, 0)).toHaveLength(3);
  });
  it('respects the daily limit minus already sent', () => {
    expect(selectBatch([r('a'), r('b'), r('c'), r('d')], 3, 1).map((x) => x.customerId)).toEqual(['a', 'b']);
  });
  it('returns nothing when the daily allowance is spent', () => {
    expect(selectBatch([r('a'), r('b')], 2, 2)).toEqual([]);
    expect(selectBatch([r('a')], 1, 5)).toEqual([]);
  });
});

describe('simulateDelivery', () => {
  it('fails deterministically on the marker, sends otherwise', () => {
    expect(simulateDelivery('cust-00f')).toBe('failed');
    expect(simulateDelivery('cust-001')).toBe('sent');
    expect(simulateDelivery('ABC')).toBe('sent');
  });
});
