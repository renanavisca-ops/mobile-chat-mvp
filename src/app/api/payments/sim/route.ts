import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { paymentsEnabled, paymentsProvider } from '@/lib/payments/config';
import { SIMULATOR_PROVIDER, simulateOutcome, canTransition } from '@/lib/payments/simulator';

/**
 * Simulated payment confirmation — DEV/TEST ONLY. Stands in for a real
 * provider's asynchronous webhook callback: it flips a pending (or retried,
 * failed) simulated payment to succeeded/failed. Active only when
 * PAYMENTS_PROVIDER=simulator. It never contacts an external service and only
 * touches rows whose provider is 'simulator'.
 *
 * Body: { paymentId, outcome?: 'succeed' | 'fail' }. Without an override the
 * outcome is deterministic (see simulateOutcome). A failed payment can be
 * confirmed again to model a retry.
 */
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!paymentsEnabled() || paymentsProvider() !== SIMULATOR_PROVIDER) {
    return NextResponse.json({ error: 'Simulator not active.', code: 'sim_not_active' }, { status: 501 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const paymentId = body?.paymentId;
  if (!paymentId) return NextResponse.json({ error: 'Missing paymentId', code: 'missing_id' }, { status: 400 });

  const { data: pay } = await (supabaseAdmin as any)
    .from('payments')
    .select('id, sender_id, amount_cents, status, provider')
    .eq('id', paymentId)
    .maybeSingle();
  if (!pay) return NextResponse.json({ error: 'Not found', code: 'not_found' }, { status: 404 });
  if (pay.provider !== SIMULATOR_PROVIDER) {
    return NextResponse.json({ error: 'Not a simulated payment', code: 'not_simulated' }, { status: 400 });
  }
  // Only the payer may drive their own simulated payment.
  if (pay.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const outcome = simulateOutcome(pay.amount_cents, body?.outcome);
  if (!canTransition(pay.status, outcome)) {
    return NextResponse.json({ status: pay.status, changed: false, code: 'no_transition' });
  }

  const { error: updErr } = await (supabaseAdmin as any)
    .from('payments')
    .update({ status: outcome })
    .eq('id', paymentId);
  if (updErr) return NextResponse.json({ error: updErr.message, code: 'update_failed' }, { status: 500 });

  return NextResponse.json({ status: outcome, changed: true, simulated: true });
}
