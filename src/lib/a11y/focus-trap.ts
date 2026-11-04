'use client';

import { useEffect, useRef } from 'react';

/**
 * Accessible focus management for modal dialogs.
 *
 * `useFocusTrap(active)` returns a ref to put on the dialog container. While
 * `active` is true it:
 *   - moves keyboard focus into the dialog (first focusable, else the container),
 *   - keeps Tab / Shift+Tab cycling inside the dialog instead of leaking to the
 *     page behind it,
 *   - restores focus to the element that was focused before it opened.
 *
 * It intentionally does NOT handle Escape or the Android back gesture — those
 * are owned by `useBackClose` — so a dialog uses both hooks together.
 */

/** CSS selector for elements that can receive keyboard focus. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Pure helper: given the index of the currently focused element within the
 * focusable list (or -1 if focus is outside the list), the number of focusable
 * elements, and whether Tab is going backwards, return the index to focus next
 * so that focus wraps around the ends. Returns -1 when there is nothing to focus.
 */
export function nextTrapIndex(activeIndex: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (backwards) {
    // Shift+Tab: wrap from the first (or from "outside") to the last.
    if (activeIndex <= 0) return count - 1;
    return activeIndex - 1;
  }
  // Tab: wrap from the last (or from "outside") to the first.
  if (activeIndex === -1 || activeIndex >= count - 1) return 0;
  return activeIndex + 1;
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container || typeof document === 'undefined') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus inside the dialog once it is open.
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const activeIndex = items.indexOf(document.activeElement as HTMLElement);
      const target = items[nextTrapIndex(activeIndex, items.length, e.shiftKey)];
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Restore focus to where it was before the dialog opened.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return ref;
}
