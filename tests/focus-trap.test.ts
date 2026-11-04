import { describe, it, expect } from 'vitest';
import { nextTrapIndex, FOCUSABLE_SELECTOR } from '../src/lib/a11y/focus-trap';

describe('nextTrapIndex', () => {
  it('returns -1 when there is nothing focusable', () => {
    expect(nextTrapIndex(-1, 0, false)).toBe(-1);
    expect(nextTrapIndex(0, 0, true)).toBe(-1);
  });

  it('Tab moves forward and wraps from the last to the first', () => {
    expect(nextTrapIndex(0, 3, false)).toBe(1);
    expect(nextTrapIndex(1, 3, false)).toBe(2);
    expect(nextTrapIndex(2, 3, false)).toBe(0); // wrap
  });

  it('Shift+Tab moves backward and wraps from the first to the last', () => {
    expect(nextTrapIndex(2, 3, true)).toBe(1);
    expect(nextTrapIndex(1, 3, true)).toBe(0);
    expect(nextTrapIndex(0, 3, true)).toBe(2); // wrap
  });

  it('when focus is outside the list, Tab goes to first and Shift+Tab to last', () => {
    expect(nextTrapIndex(-1, 3, false)).toBe(0);
    expect(nextTrapIndex(-1, 3, true)).toBe(2);
  });

  it('handles a single focusable element by staying on it', () => {
    expect(nextTrapIndex(0, 1, false)).toBe(0);
    expect(nextTrapIndex(0, 1, true)).toBe(0);
  });
});

describe('FOCUSABLE_SELECTOR', () => {
  it('excludes disabled controls and tabindex="-1"', () => {
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
