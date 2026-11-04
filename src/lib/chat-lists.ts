'use client';

/**
 * Custom chat lists ("listas personalizadas") — WhatsApp-style folders for the
 * chat list. A list is a named, ordered-by-recency subset of the user's chats
 * that shows up as a filter chip above the conversation list.
 *
 * Like broadcast lists (see `broadcast-lists.ts`), v1 stores them on-device in
 * localStorage keyed by the owner's user id, so multiple accounts on one device
 * stay separate. This needs no backend/table and works offline; the trade-off
 * is that lists don't sync across a user's devices — a later version can move
 * them to Supabase.
 */

export type ChatList = {
  id: string;
  name: string;
  chatIds: string[];
  createdAt: number;
};

const KEY = 'toky.chatLists.v1';

/** ownerId -> that user's lists */
type Store = Record<string, ChatList[]>;

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
    return `cl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ---- Pure helpers (no storage; unit-tested) ------------------------------

/** Add or replace a list by id, keeping the rest intact. */
export function upsertList(lists: ChatList[], list: ChatList): ChatList[] {
  const idx = lists.findIndex((l) => l.id === list.id);
  if (idx < 0) return [...lists, list];
  const next = lists.slice();
  next[idx] = list;
  return next;
}

/** Remove a list by id. */
export function removeList(lists: ChatList[], id: string): ChatList[] {
  return lists.filter((l) => l.id !== id);
}

/** Toggle a chat's membership in a list (returns a new list). */
export function toggleChatInList(list: ChatList, chatId: string): ChatList {
  const has = list.chatIds.includes(chatId);
  return {
    ...list,
    chatIds: has ? list.chatIds.filter((c) => c !== chatId) : [...list.chatIds, chatId],
  };
}

/** Normalize a list name: trimmed, capped, with a sensible fallback. */
export function normalizeListName(raw: string): string {
  return raw.trim().slice(0, 40) || 'Lista';
}

// ---- Storage (localStorage, keyed by owner) ------------------------------

export function getChatLists(ownerId: string): ChatList[] {
  if (!ownerId) return [];
  return (readStore()[ownerId] ?? []).slice().sort((a, b) => a.createdAt - b.createdAt);
}

export function saveChatList(ownerId: string, list: ChatList): void {
  if (!ownerId) return;
  const store = readStore();
  store[ownerId] = upsertList(store[ownerId] ?? [], list);
  writeStore(store);
}

export function createChatList(ownerId: string, name: string, chatIds: string[] = []): ChatList {
  const list: ChatList = {
    id: newId(),
    name: normalizeListName(name),
    chatIds: Array.from(new Set(chatIds)),
    createdAt: Date.now(),
  };
  saveChatList(ownerId, list);
  return list;
}

export function deleteChatList(ownerId: string, id: string): void {
  if (!ownerId) return;
  const store = readStore();
  store[ownerId] = removeList(store[ownerId] ?? [], id);
  writeStore(store);
}

export function renameChatList(ownerId: string, id: string, name: string): void {
  if (!ownerId) return;
  const store = readStore();
  const arr = store[ownerId] ?? [];
  const idx = arr.findIndex((l) => l.id === id);
  if (idx < 0) return;
  arr[idx] = { ...arr[idx], name: normalizeListName(name) };
  store[ownerId] = arr;
  writeStore(store);
}

/** Add or remove a chat from a list by id. */
export function setChatInList(ownerId: string, id: string, chatId: string, present: boolean): void {
  if (!ownerId) return;
  const store = readStore();
  const arr = store[ownerId] ?? [];
  const idx = arr.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const has = arr[idx].chatIds.includes(chatId);
  if (has === present) return;
  arr[idx] = toggleChatInList(arr[idx], chatId);
  store[ownerId] = arr;
  writeStore(store);
}
