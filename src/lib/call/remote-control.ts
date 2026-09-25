'use client';

/**
 * Remote assistance over a call: a remote **pointer** (the helper points at
 * things on the sharer's screen) and optional **co-browse control** (the helper
 * drives the sharer's Toky app — clicks, scrolls, types).
 *
 * IMPORTANT scope + safety:
 *  - This ONLY ever touches the Toky web app's own DOM. It cannot reach the
 *    operating system, other tabs or other apps — a browser page is sandboxed,
 *    exactly like a phone app. So "control" means "drive Toky", never the
 *    device (that's why AnyDesk-style control isn't possible here).
 *  - Control must be explicitly GRANTED by the person being helped, who sees a
 *    persistent "end control" banner and can stop instantly. It also ends when
 *    the call ends. Enforced in the call provider; this module only applies the
 *    events once a session is active.
 *
 * Messages travel over the existing per-call Supabase broadcast channel (see
 * call-provider) as `event: 'rc'`. Coordinates are normalized [0..1] against the
 * SHARER's viewport so they survive the video being scaled on the helper's side.
 */

export type RcKind =
  | 'ptr' // pointer move (helper -> host): {x,y}   — always allowed while sharing
  | 'ptrgone' // helper's pointer left the surface
  | 'click' // {x,y}
  | 'dblclick' // {x,y}
  | 'scroll' // {x,y,dy}
  | 'text' // {text} — insert into the focused field (typed chars / paste)
  | 'key' // {key} — a control key: Enter, Backspace, Tab, Escape, Arrow*, Delete
  | 'req' // helper requests control
  | 'grant' // host grants control
  | 'deny' // host denied / ended control
  | 'end'; // control session ended (either side)

export type RcMsg = {
  from: string;
  to: string;
  kind: RcKind;
  x?: number;
  y?: number;
  dy?: number;
  text?: string;
  key?: string;
};

/** Map a normalized point to real pixels in THIS window (the host's viewport). */
function toPixels(x: number, y: number): { px: number; py: number } {
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  const h = window.innerHeight || document.documentElement.clientHeight || 0;
  return { px: Math.round(x * w), py: Math.round(y * h) };
}

function elementAt(px: number, py: number): HTMLElement | null {
  const el = document.elementFromPoint(px, py);
  return el instanceof HTMLElement ? el : null;
}

/** Fire a full mouse sequence so React's delegated handlers run, then a click. */
function synthClick(px: number, py: number, dbl: boolean): void {
  const el = elementAt(px, py);
  if (!el) return;
  const base = { bubbles: true, cancelable: true, view: window, clientX: px, clientY: py } as MouseEventInit;
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse' } as PointerEventInit));
  } catch {
    /* PointerEvent may be unavailable */
  }
  el.dispatchEvent(new MouseEvent('mousedown', base));
  el.dispatchEvent(new MouseEvent('mouseup', base));
  // A native click() bubbles and reliably triggers React onClick / navigation.
  el.click();
  if (dbl) el.dispatchEvent(new MouseEvent('dblclick', base));
  // Focus text fields so subsequent typing lands here.
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.isContentEditable
  ) {
    el.focus();
  }
}

function scrollAt(px: number, py: number, dy: number): void {
  const el = elementAt(px, py);
  // Find the nearest scrollable ancestor; fall back to the window.
  let node: HTMLElement | null = el;
  while (node) {
    const style = getComputedStyle(node);
    const scrollable = /(auto|scroll)/.test(style.overflowY);
    if (scrollable && node.scrollHeight > node.clientHeight) {
      node.scrollBy({ top: dy });
      return;
    }
    node = node.parentElement;
  }
  window.scrollBy({ top: dy });
}

/** Set an input/textarea value the React way (native setter + input event). */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertText(text: string): void {
  const el = document.activeElement as HTMLElement | null;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + text + el.value.slice(end);
    setNativeValue(el, next);
    const caret = start + text.length;
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* number inputs etc. don't support selection */
    }
  } else if (el && el.isContentEditable) {
    document.execCommand('insertText', false, text);
  }
}

function pressKey(key: string): void {
  const el = document.activeElement as HTMLElement | null;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (key === 'Backspace') {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      if (start === end && start > 0) {
        const next = el.value.slice(0, start - 1) + el.value.slice(end);
        setNativeValue(el, next);
        try {
          el.setSelectionRange(start - 1, start - 1);
        } catch {
          /* ignore */
        }
      } else if (start !== end) {
        const next = el.value.slice(0, start) + el.value.slice(end);
        setNativeValue(el, next);
        try {
          el.setSelectionRange(start, start);
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (key === 'Enter') {
      // Let the field's own key handler run (send message, submit, newline).
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      return;
    }
  }
  // Generic dispatch for other control keys / non-field targets.
  const target = el ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

/**
 * Apply one control message to THIS document (host side). Only call this while a
 * control session is active — the caller gates on that. Pointer messages are
 * handled by the UI layer (they just move a dot), not here.
 */
export function applyRemoteControl(msg: RcMsg): void {
  if (msg.x == null || msg.y == null) {
    // Non-positional actions (typing) still need a target.
    if (msg.kind === 'text' && msg.text) insertText(msg.text);
    else if (msg.kind === 'key' && msg.key) pressKey(msg.key);
    return;
  }
  const { px, py } = toPixels(msg.x, msg.y);
  switch (msg.kind) {
    case 'click':
      synthClick(px, py, false);
      break;
    case 'dblclick':
      synthClick(px, py, true);
      break;
    case 'scroll':
      scrollAt(px, py, msg.dy ?? 0);
      break;
    case 'text':
      if (msg.text) insertText(msg.text);
      break;
    case 'key':
      if (msg.key) pressKey(msg.key);
      break;
  }
}

/** Control keys we relay from the helper's keyboard (everything else is text). */
export const RELAYED_KEYS = new Set([
  'Enter',
  'Backspace',
  'Tab',
  'Escape',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);
