import { NextResponse } from 'next/server';
import { paymentsEnabled, paymentsProvider } from '@/lib/payments/config';

/**
 * Payments webhook — SCAFFOLD ONLY (disabled).
 *
 * No money is processed here. When a provider is wired:
 *   1. Verify the signature header against the provider's webhook secret
 *      (env `PAYMENTS_WEBHOOK_SECRET`) — never trust the body unverified.
 *   2. On a verified success/failure, update the matching `public.payments`
 *      row's status to 'succeeded'/'failed' via the service role.
 *
 * Until a provider is implemented this returns 501 so nothing half-works.
 */
export async function POST() {
  if (!paymentsEnabled() || !paymentsProvider()) {
    return NextResponse.json(
      { error: 'Payments are not configured yet.', code: 'not_configured' },
      { status: 501 },
    );
  }
  // Enabled by config, but no provider integration has been shipped.
  return NextResponse.json(
    { error: 'Payments provider not implemented.', code: 'provider_not_implemented' },
    { status: 501 },
  );
}
