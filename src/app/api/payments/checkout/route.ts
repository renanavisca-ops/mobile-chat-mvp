import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { paymentsEnabled, paymentsProvider } from '@/lib/payments/config';

/**
 * Payments checkout — SCAFFOLD ONLY.
 *
 * This endpoint is intentionally not wired to a payment processor yet. When
 * you're ready, plug in a provider here (e.g. Stripe): create a PaymentIntent /
 * Checkout Session, insert a matching row into public.payments (status
 * 'pending') via the service role, and return the client secret / redirect URL.
 * A separate webhook route should then flip the row to 'succeeded'/'failed'.
 *
 * Add the provider secret as a server env var (e.g. STRIPE_SECRET_KEY) — never
 * NEXT_PUBLIC. Until then this returns 501 so nothing silently half-works.
 */
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Disabled by default; a provider is turned on by configuration (see
  // docs/PAYMENTS.md). Even when enabled, no provider integration is shipped
  // yet — nothing processes money today.
  if (!paymentsEnabled() || !paymentsProvider()) {
    return NextResponse.json({ error: 'Payments are not configured yet.', code: 'not_configured' }, { status: 501 });
  }
  return NextResponse.json({ error: 'Payments provider not implemented.', code: 'provider_not_implemented' }, { status: 501 });
}
