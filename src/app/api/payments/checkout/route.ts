import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { paymentsEnabled, paymentsProvider } from '@/lib/payments/config';
import { SIMULATOR_PROVIDER, simRef } from '@/lib/payments/simulator';

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

  // Local simulator (dev/test only). Creates a pending payment row and returns a
  // reference the client uses to drive the simulated async confirmation via
  // /api/payments/sim. No external call is made. Marked provider='simulator'.
  if (paymentsProvider() === SIMULATOR_PROVIDER) {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const amountCents = Math.trunc(Number(body?.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid amount', code: 'invalid_amount' }, { status: 400 });
    }
    const ref = simRef();
    const { data: row, error: insErr } = await (supabaseAdmin as any)
      .from('payments')
      .insert({
        sender_id: user.id,
        recipient_id: body?.recipientId ?? null,
        chat_id: body?.chatId ?? null,
        amount_cents: amountCents,
        currency: (body?.currency || 'USD').toString().slice(0, 3).toUpperCase(),
        status: 'pending',
        provider: SIMULATOR_PROVIDER,
        provider_ref: ref,
      })
      .select('id')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message, code: 'insert_failed' }, { status: 500 });
    return NextResponse.json({
      configured: true,
      simulated: true,
      paymentId: row.id,
      providerRef: ref,
      // The client "confirms" by POSTing to this endpoint (stands in for the
      // provider's asynchronous webhook callback).
      confirmPath: '/api/payments/sim',
    });
  }

  return NextResponse.json({ error: 'Payments provider not implemented.', code: 'provider_not_implemented' }, { status: 501 });
}
