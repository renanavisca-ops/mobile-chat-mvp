'use client';

/**
 * Persistent broadcast lists — the WhatsApp-style "difusión" feature.
 *
 * A broadcast list is a saved set of recipients you can message repeatedly;
 * sending fans the message out to each member's one-to-one chat (each person
 * receives it privately, as if you'd messaged them directly).
 *
 * v1 stores the lists on-device in localStorage, keyed by the owner's user id
 * so multiple accounts on one device don't see each other's lists. This needs
 * no backend/table and works offline; the trade-off is that lists don't sync
 * across a user's devices — a later version can move them to Supabase.
 */

export type BroadcastMember = { id: string; username: string | null };

export type BroadcastList = {
  id: string;
  name: string;
  members: BroadcastMember[];
  createdAt: number;
};

const KEY = 'toky.broadcastLists.v1';

/** ownerId -> that user's lists */
type Store = Record<string, BroadcastList[]>;

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
    /* private mode / quota — nothing else we can do */
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `bl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function listBroadcastLists(ownerId: string): BroadcastList[] {
  if (!ownerId) return [];
  return (readStore()[ownerId] ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveBroadcastList(ownerId: string, list: BroadcastList): void {
  if (!ownerId) return;
  const store = readStore();
  const arr = store[ownerId] ?? [];
  const idx = arr.findIndex((l) => l.id === list.id);
  if (idx >= 0) arr[idx] = list;
  else arr.push(list);
  store[ownerId] = arr;
  writeStore(store);
}

export function createBroadcastList(
  ownerId: string,
  name: string,
  members: BroadcastMember[],
): BroadcastList {
  const list: BroadcastList = {
    id: newId(),
    name: name.trim().slice(0, 60) || 'Difusión',
    // De-dup members by id.
    members: Array.from(new Map(members.map((m) => [m.id, m])).values()),
    createdAt: Date.now(),
  };
  saveBroadcastList(ownerId, list);
  return list;
}

export function deleteBroadcastList(ownerId: string, id: string): void {
  if (!ownerId) return;
  const store = readStore();
  store[ownerId] = (store[ownerId] ?? []).filter((l) => l.id !== id);
  writeStore(store);
}
