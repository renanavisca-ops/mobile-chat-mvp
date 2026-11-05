import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { campaignsSendingEnabled, campaignsChannel, campaignsSimulated } from '@/lib/campaigns/config';
import { selectBatch, simulateDelivery } from '@/lib/campaigns/sender';

/**
 * Campaign send worker — the actual delivery runs through the configured
 * channel. DISABLED by default: returns 501 unless CAMPAIGNS_ENABLED=1 and a
 * channel is set. Today only CAMPAIGNS_CHANNEL=simulator is implemented and it
 * makes NO external call — it records simulated deliveries so the full flow
 * (audience → per-recipient send/fail → status) can be exercised. A real
 * SMS/WhatsApp/email adapter is still pending (see docs/CAMPAIGNS.md).
 *
 * One call processes one run: it sends to the authorized audience (consented,
 * not opted out) up to the campaign's daily limit, then reports the summary.
 */
export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!campaignsSendingEnabled() || !campaignsChannel()) {
    return NextResponse.json({ error: 'Campaign sending is not configured.', code: 'not_configured' }, { status: 501 });
  }
  if (!campaignsSimulated()) {
    // A real channel is configured by name but its adapter isn't implemented.
    return NextResponse.json({ error: 'Channel adapter not implemented.', code: 'channel_not_implemented' }, { status: 501 });
  }

  // Only a store admin may send their store's campaigns.
  const { data: prof } = await (supabaseAdmin as any)
    .from('profiles').select('role, store_id').eq('id', user.id).maybeSingle();
  if (!prof?.store_id || !['admin', 'superadmin'].includes(prof.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const campaignId = body?.campaignId;
  if (!campaignId) return NextResponse.json({ error: 'Missing campaignId', code: 'missing_id' }, { status: 400 });

  const { data: campaign } = await (supabaseAdmin as any)
    .from('campaigns').select('id, store_id, daily_limit, status').eq('id', campaignId).maybeSingle();
  if (!campaign || campaign.store_id !== prof.store_id) {
    return NextResponse.json({ error: 'Not found', code: 'not_found' }, { status: 404 });
  }
  if (campaign.status === 'sent' || campaign.status === 'cancelled') {
    return NextResponse.json({ error: 'Campaign is not sendable', code: 'bad_status' }, { status: 409 });
  }

  // Authorized audience: consented, not opted out.
  const { data: consentRows } = await (supabaseAdmin as any)
    .from('store_customer_consent')
    .select('customer_id, consent, opted_out_at')
    .eq('store_id', campaign.store_id)
    .eq('consent', true)
    .is('opted_out_at', null);
  const audience = ((consentRows as any[]) || [])
    .filter((r) => r.customer_id)
    .map((r) => ({ customerId: r.customer_id as string }));

  // Already-sent (or attempted) recipients for this campaign, to avoid
  // duplicates and to respect the daily limit across runs.
  const { data: doneRows } = await (supabaseAdmin as any)
    .from('campaign_deliveries').select('customer_id').eq('campaign_id', campaign.id);
  const done = new Set(((doneRows as any[]) || []).map((r) => r.customer_id));
  const remainingAudience = audience.filter((a) => !done.has(a.customerId));

  const batch = selectBatch(remainingAudience, campaign.daily_limit ?? 0, done.size);
  let sent = 0, failed = 0;
  if (batch.length > 0) {
    const rows = batch.map((r) => {
      const outcome = simulateDelivery(r.customerId);
      if (outcome === 'sent') sent++; else failed++;
      return {
        campaign_id: campaign.id,
        store_id: campaign.store_id,
        customer_id: r.customerId,
        status: outcome,
        channel: 'simulator',
        sent_at: new Date().toISOString(),
      };
    });
    await (supabaseAdmin as any).from('campaign_deliveries').insert(rows);
  }

  // If everyone in the authorized audience has now been processed, the campaign
  // is done; otherwise it's mid-send (e.g. capped by the daily limit).
  const processedTotal = done.size + batch.length;
  const newStatus = processedTotal >= audience.length ? 'sent' : 'sending';
  await (supabaseAdmin as any).from('campaigns').update({ status: newStatus }).eq('id', campaign.id);

  return NextResponse.json({
    ok: true,
    simulated: true,
    sent,
    failed,
    processedTotal,
    audienceTotal: audience.length,
    status: newStatus,
  });
}
