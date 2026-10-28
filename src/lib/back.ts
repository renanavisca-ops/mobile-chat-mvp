'use client';

import { useEffect, useRef } from 'react';

/**
 * Global back-gesture / back-button stack.
 *
 * On Android the edge-swipe (and hardware back) should close whatever overlay
 * is on top — a lightbox, a sheet, an info modal — before it navigates away
 * from the screen. Overlays register a close handler while they're open; the
 * single Capacitor `backButton` listener (see BackButtonHandler) pops the most
 * recently opened one. When nothing is registered it falls back to normal
 * history navigation.
 */

type Entry = { id: number; close: () => void };

let stack: Entry[] = [];
let seq = 1;

function pushBackHandler(close: () => void): () => void {
  const id = seq++;
  stack.push({ id, close });
  return () => {
    stack = stack.filter((e) => e.id !== id);
  };
}

/** Close the top overlay if any is open. Returns true if one was closed. */
export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  stack = stack.filter((e) => e.id !== top.id);
  try {
    top.close();
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Register an overlay's close handler while `open` is true. The latest opened
 * overlay is the first to close on back. `onClose` may change between renders
 * (kept in a ref) without re-ordering the stack.
 */
export function useBackClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return;
    return pushBackHandler(() => ref.current());
  }, [open]);
}
