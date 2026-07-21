'use client';

// Per-user state that lives on the device (not tied to the Supabase session):
// the local E2EE device bundle, the active device id, the cached username, and
// the E2EE keystore (IndexedDB). If this leaks between accounts on a shared
// browser, a second user inherits the first user's identity — so we clear it on
// sign-out and whenever a different account signs in.
const IDENTITY_KEYS = ['device_bundle', 'active_device_id', 'username'];
const LAST_USER_KEY = 'toky_auth_user_id';
const E2EE_DB = 'toky-e2ee';

export function clearLocalIdentity(): void {
  try {
    for (const k of IDENTITY_KEYS) localStorage.removeItem(k);
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore storage errors
  }
  try {
    indexedDB.deleteDatabase(E2EE_DB);
  } catch {
    // ignore
  }
}

/**
 * Call right after a successful sign-in / sign-up. If the account differs from
 * the last one seen on this browser, wipe the previous user's local identity so
 * the new user starts clean; otherwise keep it (same user re-logging in keeps
 * their device + keys). Always records the current user id.
 */
export function reconcileLocalIdentity(userId: string): void {
  try {
    const prev = localStorage.getItem(LAST_USER_KEY);
    if (prev && prev !== userId) clearLocalIdentity();
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // ignore
  }
}
