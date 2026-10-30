'use client';

import { sendMessage, type MessagePayload } from '@/lib/db/chats';

/**
 * Offline send queue with idempotent retries.
 *
 * When a text/payload-only message can't be sent (offline or a transient
 * network error), it's queued on-device with a stable client_id and retried
 * when connectivity returns. The server-side unique (sender_id, client_id)
 * makes a retry that already landed a no-op, so nothing is ever duplicated.
 *
 * Media sends aren't queued here — their upload needs the network up front.
 */

type Queued = { chatId: string; payload: MessagePayload; clientId: string; ts: number };

const KEY = 'toky.sendqueue';
let flushing = false;

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Queued[]) : [];
  } catch {
    return [];
  }
}
function write(items: Queued[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota */ }
}

/** True for errors that are worth retrying later rather than surfacing now. */
function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((e as any)?.message ?? e ?? '').toLowerCase();
  return e instanceof TypeError || msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('failed to');
}

/**
 * Send now, or queue for later on a network failure. Returns { queued }.
 * A stable clientId makes the eventual (possibly retried) send idempotent.
 * Non-network errors (e.g. permission) are rethrown for the caller to show.
 */
export async function sendQueued(chatId: string, payload: MessagePayload): Promise<{ queued: boolean; clientId: string }> {
  const clientId = crypto.randomUUID();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    write([...read(), { chatId, payload, clientId, ts: Date.now() }]);
    return { queued: true, clientId };
  }
  try {
    await sendMessage(chatId, payload, clientId);
    return { queued: false, clientId };
  } catch (e) {
    if (isNetworkError(e)) {
      write([...read(), { chatId, payload, clientId, ts: Date.now() }]);
      return { queued: true, clientId };
    }
    throw e;
  }
}

/** Try to send everything queued, oldest first. Safe to call repeatedly. */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    let items = read();
    while (items.length > 0) {
      const item = items[0];
      try {
        await sendMessage(item.chatId, item.payload, item.clientId);
      } catch (e) {
        if (isNetworkError(e)) break; // still offline — keep the rest for later
        // A permanent error: drop this item so it can't wedge the queue.
      }
      items = read().filter((q) => q.clientId !== item.clientId);
      write(items);
    }
  } finally {
    flushing = false;
  }
}

export function queuedCount(): number {
  return read().length;
}

/** Wire up automatic flushing (online event + an occasional sweep). */
export function startSendQueue(): () => void {
  const onOnline = () => { void flushQueue(); };
  void flushQueue();
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onOnline);
  const iv = window.setInterval(() => { void flushQueue(); }, 20000);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onOnline);
    window.clearInterval(iv);
  };
}
