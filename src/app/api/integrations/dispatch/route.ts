import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { integrationsEnabled, integrationsTarget } from '@/lib/integrations/config';
import { pickAdapter, deliverLocal, type OutboxEvent } from '@/lib/integrations/adapter';

/**
 * Drain the integration outbox to the configured target. DISABLED by default:
 * returns 501 unless INTEGRATIONS_ENABLED=1 with a target. Today only
 * INTEGRATIONS_TARGET=local is implemented and it makes NO external call — it
 * marks pending events delivered so the flow can be exercised. A real
 * CRM/webhook adapter is still pending (see docs/INTEGRATIONS.md).
 */
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adapter = pickAdapter(integrationsEnabled(), integrationsTarget());
  if (adapter === 'disabled') {
    return NextResponse.json({ error: 'Integration delivery is not configured.', code: 'not_configured' }, { status: 501 });
  }
  if (adapter === 'unimplemented') {
    return NextResponse.json({ error: 'Target adapter not implemented.', code: 'adapter_not_implemented' }, { status: 501 });
  }

  // Admin of a store drains that store's outbox.
  const { data: prof } = await (supabaseAdmin as any)
    .from('profiles').select('role, store_id').eq('id', user.id).maybeSingle();
  if (!prof?.store_id || !['admin', 'superadmin'].includes(prof.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: rows } = await (supabaseAdmin as any)
    .from('integration_events')
    .select('id, type, data')
    .eq('store_id', prof.store_id)
    .eq('delivered', false)
    .order('created_at', { ascending: true })
    .limit(200);

  const events = ((rows as any[]) || []) as OutboxEvent[];
  if (events.length === 0) return NextResponse.json({ ok: true, delivered: 0 });

  const { deliveredIds } = deliverLocal(events);
  if (deliveredIds.length > 0) {
    await (supabaseAdmin as any).from('integration_events').update({ delivered: true }).in('id', deliveredIds);
  }
  return NextResponse.json({ ok: true, delivered: deliveredIds.length, target: 'local', simulated: true });
}
