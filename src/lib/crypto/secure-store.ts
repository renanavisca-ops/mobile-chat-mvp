'use client';

/**
 * Native OS-backed storage for the identity private key, used only inside the
 * Capacitor iOS/Android shells:
 *   - iOS:     Apple Keychain
 *   - Android: EncryptedSharedPreferences (Android Keystore-backed)
 *
 * On the web this is never used — the web build keeps its IndexedDB fallback
 * (see keystore.ts). The plugin is imported lazily so web bundles don't execute
 * native code. We do NOT claim Secure Enclave / hardware-backed storage; that
 * depends on the device and is not asserted here.
 */

import { isNativeApp } from '@/lib/native-push';
import type { KeyBackend } from './key-migration';

const SECURE_KEY = 'toky_identity_priv';

type SecureStoragePlugin = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  remove(key: string): Promise<unknown>;
};

let _plugin: SecureStoragePlugin | null = null;
async function getPlugin(): Promise<SecureStoragePlugin> {
  if (_plugin) return _plugin;
  const mod = await import('@aparajita/capacitor-secure-storage');
  _plugin = mod.SecureStorage as unknown as SecureStoragePlugin;
  return _plugin;
}

/** True only inside the native shells, where secure storage is available. */
export function secureStorageSupported(): boolean {
  return isNativeApp();
}

export const secureBackend: KeyBackend = {
  async get() {
    const S = await getPlugin();
    const v = await S.get(SECURE_KEY);
    if (v == null) return null;
    return typeof v === 'string' ? v : String(v);
  },
  async set(value: string) {
    const S = await getPlugin();
    await S.set(SECURE_KEY, value);
  },
  async remove() {
    const S = await getPlugin();
    try {
      await S.remove(SECURE_KEY);
    } catch {
      // absent / already removed
    }
  },
};
