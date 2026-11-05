// Local payment simulator — DEV/TEST ONLY. It never contacts an external
// service and is active only when PAYMENTS_PROVIDER=simulator (with
// PAYMENTS_ENABLED=1). It drives the full payment lifecycle so the flow can be
// exercised end to end — create → pending → asynchronous success/failure, plus
// retry of a failed payment — without wiring a real processor. Every row it
// creates is marked provider='simulator' so simulated data is never mistaken
// for real money movement.
//
// A real provider (e.g. Stripe) is a SEPARATE, still-pending adapter: see
// docs/PAYMENTS.md for exactly what remains (secret key, PaymentIntent/Checkout
// creation, signed webhook verification). The simulator does NOT prove the real
// integration works.

export const SIMULATOR_PROVIDER = 'simulator';

export type SimOutcome = 'succeeded' | 'failed';

/**
 * Decide the outcome of a simulated confirmation. Deterministic so tests and
 * demos are repeatable: an explicit override wins; otherwise amounts whose cents
 * part is 13 fail (an easy way to exercise the failure path), everything else
 * succeeds.
 */
export function simulateOutcome(amountCents: number, override?: string | null): SimOutcome {
  if (override === 'fail') return 'failed';
  if (override === 'succeed') return 'succeeded';
  return Math.abs(Math.trunc(amountCents)) % 100 === 13 ? 'failed' : 'succeeded';
}

/** A fake provider reference for a simulated payment. */
export function simRef(): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    : Math.random().toString(36).slice(2, 12);
  return `sim_${Date.now().toString(36)}_${rand}`;
}

/**
 * Allowed status transitions for a simulated payment. pending → succeeded|failed
 * is the async provider callback; failed → pending models a retry (which can
 * then succeed). Anything else (e.g. mutating a succeeded payment) is rejected.
 */
export function canTransition(from: string, to: string): boolean {
  if (from === 'pending') return to === 'succeeded' || to === 'failed';
  if (from === 'failed') return to === 'pending' || to === 'succeeded';
  return false;
}
