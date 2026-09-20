'use client';

/**
 * Scheduled (send-later) messages — device-side.
 *
 * The item is stored on-device (localStorage, keyed by the owner's user id) with
 * the target chat and the send time. A global runner (ScheduledSender) sends it
 * through the normal `sendMessage` path when it comes due while the app is open
 * (and flushes anything already due on open), so end-to-end encryption is
 * applied exactly as for a live message. Trade-off: it fires while the app is
 * running — not from a closed app — which keeps E2EE intact without a server
 * holding plaintext. Text-only in v1.
 */

export type ScheduledMessage = {
  id: string;
  chatId: string;
  chatLabel: string;
  text: string;
  at: number; // epoch ms to send at
  createdAt: number;
};

const KEY = 'toky.scheduled.v1';

type Store = Record<string, ScheduledMessage[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota */
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `sm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function listScheduled(ownerId: string): ScheduledMessage[] {
  if (!ownerId) return [];
  return (readStore()[ownerId] ?? []).slice().sort((a, b) => a.at - b.at);
}

export function listScheduledForChat(ownerId: string, chatId: string): ScheduledMessage[] {
  return listScheduled(ownerId).filter((s) => s.chatId === chatId);
}

export function addScheduled(
  ownerId: string,
  item: Omit<ScheduledMessage, 'id' | 'createdAt'>,
): ScheduledMessage {
  const full: ScheduledMessage = { ...item, id: newId(), createdAt: Date.now() };
  const store = readStore();
  store[ownerId] = [...(store[ownerId] ?? []), full];
  writeStore(store);
  return full;
}

export function removeScheduled(ownerId: string, id: string): void {
  if (!ownerId) return;
  const store = readStore();
  store[ownerId] = (store[ownerId] ?? []).filter((s) => s.id !== id);
  writeStore(store);
}

export function dueScheduled(ownerId: string, now = Date.now()): ScheduledMessage[] {
  return listScheduled(ownerId).filter((s) => s.at <= now);
}
