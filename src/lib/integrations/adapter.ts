// Integration delivery adapters. The ONLY implemented adapter is 'local',
// which drains the outbox without any network call (dev/test). Any other
// target names a real destination (CRM / webhook) whose adapter is still
// pending — see docs/INTEGRATIONS.md. Keeping this selection pure makes it
// unit-testable and keeps producers decoupled from the destination.

export type AdapterKind = 'local' | 'unimplemented' | 'disabled';

/** Which adapter handles a given (enabled, target) pair. */
export function pickAdapter(enabled: boolean, target: string): AdapterKind {
  if (!enabled || !target) return 'disabled';
  if (target === 'local') return 'local';
  return 'unimplemented';
}

export type OutboxEvent = { id: number; type: string; data: Record<string, unknown> };

/**
 * The local adapter's "delivery": a pure transform that acknowledges each event
 * without any side effect, returning the ids to mark delivered. A real adapter
 * would POST to the target and only ack what the target accepted; this stand-in
 * accepts everything so the drain flow can be exercised offline.
 */
export function deliverLocal(events: OutboxEvent[]): { deliveredIds: number[] } {
  return { deliveredIds: events.map((e) => e.id) };
}
