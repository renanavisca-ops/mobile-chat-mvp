/**
 * Safe, idempotent migration of the identity private key between two backends
 * (e.g. IndexedDB → OS secure storage). Kept pure and backend-agnostic so the
 * "never delete the source before the destination is verified" invariant is
 * unit-testable without native plugins.
 *
 * Never logs key material.
 */

export interface KeyBackend {
  /** Return the stored serialized key, or null. */
  get(): Promise<string | null>;
  /** Store the serialized key. */
  set(value: string): Promise<void>;
  /** Remove the stored key (no-op if absent). */
  remove(): Promise<void>;
}

export type MigrationResult = 'migrated' | 'already' | 'none' | 'kept';

/**
 * Move the key from `from` to `to`.
 *  - 'already' : `to` already has a key → clean up any stale `from` copy.
 *  - 'none'    : nothing to migrate.
 *  - 'migrated': copied to `to`, verified by read-back, then removed from `from`.
 *  - 'kept'    : read-back did NOT match → source left intact (recoverable).
 *
 * Idempotent: running it again after a successful migration returns 'already'
 * and makes no changes.
 */
export async function migrateKey(from: KeyBackend, to: KeyBackend): Promise<MigrationResult> {
  const existing = await to.get();
  if (existing) {
    // Destination already holds a key. Remove any leftover source copy so the
    // plaintext IndexedDB value doesn't linger.
    if (await from.get()) await from.remove();
    return 'already';
  }

  const legacy = await from.get();
  if (!legacy) return 'none';

  await to.set(legacy);

  // Verify the destination really has the value before deleting the source.
  const readback = await to.get();
  if (readback !== legacy) return 'kept';

  await from.remove();
  return 'migrated';
}
