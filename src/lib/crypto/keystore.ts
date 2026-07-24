'use client';

/**
 * Browser-side key management for E2EE.
 *
 *  - The identity private key lives in IndexedDB (same-origin protected) so
 *    encryption "just works" on this device after enrollment.
 *  - The identity public key is published to `user_keys` so others can wrap
 *    chat keys to us.
 *  - A passphrase-protected backup of the private key can be stored in
 *    `key_backups` so the account can be restored on another device/browser.
 *  - Per-chat AES keys are fetched (as our own wrapped row in `chat_keys`),
 *    unwrapped once, and cached in memory for the session.
 */

import { browserSupabase } from '@/lib/supabase/client';
import * as e2ee from './e2ee';
import type { Jwk, WrappedKey, Sealed, KeyBackup } from './e2ee';
import type { Json } from '@/lib/db/database.types';

let identityPrivate: CryptoKey | null = null;
let identityPubJwk: Jwk | null = null;
const chatKeyCache = new Map<string, CryptoKey>();
let initPromise: Promise<void> | null = null;

// ---------- IndexedDB (local private key) ----------

const DB_NAME = 'toky-e2ee';
const STORE = 'keys';
const PRIV_KEY = 'identity-priv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- init / state ----------

/** Load the local private key from IndexedDB, if this device is enrolled. */
export function initKeystore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const jwk = await idbGet<Jwk>(PRIV_KEY);
      if (jwk) {
        identityPrivate = await e2ee.importPrivateJwk(jwk);
        identityPubJwk = e2ee.publicJwkFromPrivate(jwk);
      }
    } catch {
      // no local key / IndexedDB unavailable
    }
  })();
  return initPromise;
}

export function isUnlocked(): boolean {
  return !!identityPrivate;
}

/**
 * Make sure this account has an encryption identity so chats can be end-to-end
 * encrypted by default. Safe to call on every sign-in:
 *  - already unlocked on this device → nothing to do
 *  - brand-new account (never published a key) → enroll one now
 *  - account published a key elsewhere but this device has no local copy →
 *    leave it; the user restores from their passphrase backup (recovery flow).
 */
export async function ensureIdentity(): Promise<void> {
  await initKeystore();
  if (identityPrivate) return;
  const published = await hasPublishedIdentity();
  if (!published) await enrollNewIdentity();
}

async function myUserId(): Promise<string | null> {
  const supabase = browserSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------- enrollment / publishing ----------

async function publishIdentityPub(): Promise<void> {
  if (!identityPubJwk) return;
  const uid = await myUserId();
  if (!uid) return;
  const supabase = browserSupabase();
  await supabase
    .from('user_keys')
    .upsert({ user_id: uid, identity_pub: identityPubJwk as unknown as Json }, { onConflict: 'user_id' });
}

/** Generate a brand-new identity for this account (first-time setup). */
export async function enrollNewIdentity(): Promise<void> {
  const pair = await e2ee.generateIdentity();
  const privJwk = await e2ee.exportPrivateJwk(pair.privateKey);
  await idbSet(PRIV_KEY, privJwk);
  identityPrivate = pair.privateKey;
  identityPubJwk = await e2ee.exportPublicJwk(pair.publicKey);
  await publishIdentityPub();
}

export async function getMyIdentityPub(): Promise<Jwk | null> {
  await initKeystore();
  return identityPubJwk;
}

export async function myFingerprint(): Promise<string | null> {
  const pub = await getMyIdentityPub();
  return pub ? e2ee.fingerprint(pub) : null;
}

/** Whether a server-side (passphrase) backup exists for this account. */
export async function hasServerBackup(): Promise<boolean> {
  const uid = await myUserId();
  if (!uid) return false;
  const supabase = browserSupabase();
  const { data } = await supabase.from('key_backups').select('user_id').eq('user_id', uid).maybeSingle();
  return !!data;
}

/** Whether this account has ever published an identity key. */
export async function hasPublishedIdentity(): Promise<boolean> {
  const uid = await myUserId();
  if (!uid) return false;
  const supabase = browserSupabase();
  const { data } = await supabase.from('user_keys').select('user_id').eq('user_id', uid).maybeSingle();
  return !!data;
}

/** Encrypt & upload a passphrase-protected backup of the private key. */
export async function saveBackup(passphrase: string): Promise<void> {
  if (!identityPrivate) throw new Error('Encryption is locked on this device.');
  const uid = await myUserId();
  if (!uid) throw new Error('Not signed in.');
  const backup = await e2ee.backupPrivateKey(identityPrivate, passphrase);
  const supabase = browserSupabase();
  const { error } = await supabase
    .from('key_backups')
    .upsert({ user_id: uid, backup: backup as unknown as Json }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Restore the identity private key from the passphrase backup onto this device. */
export async function restoreFromPassphrase(passphrase: string): Promise<void> {
  const uid = await myUserId();
  if (!uid) throw new Error('Not signed in.');
  const supabase = browserSupabase();
  const { data, error } = await supabase.from('key_backups').select('backup').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  if (!data?.backup) throw new Error('No backup found for this account.');
  const priv = await e2ee.restorePrivateKey(passphrase, data.backup as unknown as KeyBackup);
  const privJwk = await e2ee.exportPrivateJwk(priv);
  await idbSet(PRIV_KEY, privJwk);
  identityPrivate = priv;
  identityPubJwk = e2ee.publicJwkFromPrivate(privJwk);
  chatKeyCache.clear();
  await publishIdentityPub();
}

/** Remove the local key from this device (does not touch the server backup). */
export async function forgetLocalKey(): Promise<void> {
  await idbDel(PRIV_KEY);
  identityPrivate = null;
  identityPubJwk = null;
  chatKeyCache.clear();
  initPromise = null;
}

// ---------- per-chat keys ----------

async function fetchMemberPub(userId: string): Promise<Jwk | null> {
  const supabase = browserSupabase();
  const { data } = await supabase.from('user_keys').select('identity_pub').eq('user_id', userId).maybeSingle();
  return (data?.identity_pub as unknown as Jwk) ?? null;
}

/** Get the AES chat key for a locked chat (from cache or by unwrapping my row). */
export async function getChatKey(chatId: string): Promise<CryptoKey | null> {
  await initKeystore();
  if (!identityPrivate) return null;
  const cached = chatKeyCache.get(chatId);
  if (cached) return cached;
  const uid = await myUserId();
  if (!uid) return null;
  const supabase = browserSupabase();
  const { data } = await supabase
    .from('chat_keys')
    .select('wrapped, key_epoch')
    .eq('chat_id', chatId)
    .eq('user_id', uid)
    .order('key_epoch', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.wrapped) return null;
  try {
    const key = await e2ee.unwrapChatKey(identityPrivate, data.wrapped as unknown as WrappedKey);
    chatKeyCache.set(chatId, key);
    return key;
  } catch {
    return null;
  }
}

/**
 * Turn on encryption for a chat: create a chat key and wrap it for every
 * member. Returns the list of member ids that had no published key (so the
 * caller can warn). If any member lacks a key, we do NOT lock.
 */
export async function lockChat(
  chatId: string,
  memberIds: string[]
): Promise<{ ok: boolean; missing: string[] }> {
  await initKeystore();
  if (!identityPrivate) throw new Error('Set up encryption on this device first.');
  const uid = await myUserId();
  if (!uid) throw new Error('Not signed in.');

  // Idempotency guard: if this chat is already locked (I already hold its key),
  // never regenerate — a new chat key would make earlier messages unreadable.
  const existingKey = await getChatKey(chatId);
  if (existingKey) return { ok: true, missing: [] };

  const members = Array.from(new Set([...memberIds, uid]));
  const pubs = new Map<string, Jwk>();
  const missing: string[] = [];
  for (const m of members) {
    const pub = m === uid ? identityPubJwk : await fetchMemberPub(m);
    if (pub) pubs.set(m, pub);
    else missing.push(m);
  }
  if (missing.length > 0) return { ok: false, missing };

  const chatKey = await e2ee.generateChatKey();
  const supabase = browserSupabase();
  const rows: { chat_id: string; user_id: string; key_epoch: number; wrapped: Json; created_by: string }[] = [];
  for (const [m, pub] of pubs) {
    const wrapped = await e2ee.wrapChatKeyFor(pub, chatKey);
    rows.push({
      chat_id: chatId,
      user_id: m,
      key_epoch: 1,
      wrapped: wrapped as unknown as Json,
      created_by: uid,
    });
  }
  const { error: keyErr } = await supabase.from('chat_keys').upsert(rows, {
    onConflict: 'chat_id,user_id,key_epoch',
  });
  if (keyErr) throw keyErr;

  const { error: chatErr } = await supabase.from('chats').update({ encrypted: true }).eq('id', chatId);
  if (chatErr) throw chatErr;

  chatKeyCache.set(chatId, chatKey);
  return { ok: true, missing: [] };
}

/** Ensure a newly-added member gets the existing chat key wrapped for them. */
export async function shareChatKeyWith(chatId: string, userId: string): Promise<boolean> {
  const chatKey = await getChatKey(chatId);
  if (!chatKey) return false;
  const pub = await fetchMemberPub(userId);
  if (!pub) return false;
  const uid = await myUserId();
  const wrapped = await e2ee.wrapChatKeyFor(pub, chatKey);
  const supabase = browserSupabase();
  const { error } = await supabase.from('chat_keys').upsert(
    {
      chat_id: chatId,
      user_id: userId,
      key_epoch: 1,
      wrapped: wrapped as unknown as Json,
      created_by: uid ?? undefined,
    },
    { onConflict: 'chat_id,user_id,key_epoch' }
  );
  return !error;
}

// ---------- message sealing helpers ----------

export async function encryptForChat(chatId: string, plaintext: string): Promise<Sealed | null> {
  const key = await getChatKey(chatId);
  if (!key) return null;
  return e2ee.encryptString(key, plaintext);
}

export async function decryptForChat(chatId: string, sealed: Sealed): Promise<string | null> {
  const key = await getChatKey(chatId);
  if (!key) return null;
  try {
    return await e2ee.decryptString(key, sealed);
  } catch {
    return null;
  }
}
