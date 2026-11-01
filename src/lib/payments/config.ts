// Payments configuration gate (server-side). Payments are DISABLED by default
// and no processor is wired. This is only the activation contract: a future
// provider is turned on by environment variables, never by shipping money logic
// here. See docs/PAYMENTS.md.
//
// Even when PAYMENTS_ENABLED is set, the routes still refuse with
// 'provider_not_implemented' until an actual provider integration is added —
// nothing processes money today.

/** True only if payments have been explicitly enabled by configuration. */
export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === '1';
}

/** The configured provider name, if any (e.g. 'stripe'). Empty when unset. */
export function paymentsProvider(): string {
  return (process.env.PAYMENTS_PROVIDER || '').trim();
}
