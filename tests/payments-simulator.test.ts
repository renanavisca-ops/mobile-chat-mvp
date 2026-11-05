import { describe, it, expect } from 'vitest';
import { simulateOutcome, canTransition, simRef, SIMULATOR_PROVIDER } from '../src/lib/payments/simulator';

describe('simulateOutcome', () => {
  it('honors an explicit override', () => {
    expect(simulateOutcome(1000, 'fail')).toBe('failed');
    expect(simulateOutcome(13, 'succeed')).toBe('succeeded');
  });
  it('fails deterministically on the .13 cents marker, succeeds otherwise', () => {
    expect(simulateOutcome(113)).toBe('failed');
    expect(simulateOutcome(1013)).toBe('failed');
    expect(simulateOutcome(1000)).toBe('succeeded');
    expect(simulateOutcome(2500)).toBe('succeeded');
  });
});

describe('canTransition', () => {
  it('allows the async pending → succeeded/failed callback', () => {
    expect(canTransition('pending', 'succeeded')).toBe(true);
    expect(canTransition('pending', 'failed')).toBe(true);
  });
  it('allows retry from failed, but never mutates a succeeded payment', () => {
    expect(canTransition('failed', 'succeeded')).toBe(true);
    expect(canTransition('failed', 'pending')).toBe(true);
    expect(canTransition('succeeded', 'failed')).toBe(false);
    expect(canTransition('succeeded', 'pending')).toBe(false);
  });
});

describe('simRef', () => {
  it('is marked as a simulator reference and unique-ish', () => {
    const a = simRef();
    const b = simRef();
    expect(a.startsWith('sim_')).toBe(true);
    expect(a).not.toBe(b);
    expect(SIMULATOR_PROVIDER).toBe('simulator');
  });
});
