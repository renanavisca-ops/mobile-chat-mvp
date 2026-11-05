// Pure campaign-send logic (channel-agnostic, unit-tested). The worker route
// uses this to decide which authorized recipients to send to in one run,
// respecting the daily limit, and to compute a simulated per-recipient outcome.
// The actual delivery is performed by the configured channel; today only the
// local simulator is implemented (no external call) — see docs/CAMPAIGNS.md.

export type Recipient = { customerId: string };

/**
 * Pick the recipients to process in this run. `audience` is the authorized set
 * (consented, not opted out). `alreadySent` is how many were already delivered
 * for this campaign today; `dailyLimit` of 0 means no limit. Never exceeds the
 * remaining daily allowance.
 */
export function selectBatch<T extends Recipient>(audience: T[], dailyLimit: number, alreadySent: number): T[] {
  if (dailyLimit && dailyLimit > 0) {
    const remaining = Math.max(0, dailyLimit - Math.max(0, alreadySent));
    return audience.slice(0, remaining);
  }
  return audience.slice();
}

export type DeliveryOutcome = 'sent' | 'failed';

/**
 * Deterministic simulated outcome for one recipient, so demos/tests are
 * repeatable: a customer id whose last hex-ish char is 'f' fails (to exercise
 * the failure path), everything else is sent.
 */
export function simulateDelivery(customerId: string): DeliveryOutcome {
  const last = (customerId || '').trim().slice(-1).toLowerCase();
  return last === 'f' ? 'failed' : 'sent';
}
