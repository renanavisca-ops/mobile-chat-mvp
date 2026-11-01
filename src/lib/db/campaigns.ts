'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

/** An internal campaign. Sending is NOT implemented (see docs/CAMPAIGNS.md). */
export type Campaign = {
  id: string;
  storeId: string;
  name: string;
  body: string;
  status: CampaignStatus;
  dailyLimit: number;
  scheduledAt: string | null;
  createdAt: string;
};

export type CampaignInput = {
  id?: string;
  name: string;
  body: string;
  dailyLimit: number;
  status?: CampaignStatus;
};

function mapRow(r: any): Campaign {
  return {
    id: r.id,
    storeId: r.store_id,
    name: r.name,
    body: r.body,
    status: (r.status ?? 'draft') as CampaignStatus,
    dailyLimit: r.daily_limit ?? 0,
    scheduledAt: r.scheduled_at ?? null,
    createdAt: r.created_at,
  };
}

/** List a store's campaigns (staff can read; enforced by RLS). */
export async function listCampaigns(storeId: string): Promise<Campaign[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('campaigns')
    .select('id, store_id, name, body, status, daily_limit, scheduled_at, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Create or update a campaign (draft). RLS limits writes to store admins. */
export async function upsertCampaign(storeId: string, input: CampaignInput): Promise<void> {
  const supabase = browserSupabase();
  const row: any = {
    store_id: storeId,
    name: input.name.trim(),
    body: input.body.trim(),
    daily_limit: Math.max(0, Math.floor(input.dailyLimit || 0)),
  };
  if (input.status) row.status = input.status;
  if (input.id) row.id = input.id;
  const { error } = await (supabase as any).from('campaigns').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a campaign. RLS limits this to store admins. */
export async function deleteCampaign(id: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

/** Count of authorized recipients (consented, not opted out). 0 on error. */
export async function getAudienceCount(storeId: string): Promise<number> {
  const supabase = browserSupabase();
  try {
    const { data, error } = await (supabase as any).rpc('campaign_audience_count', { p_store_id: storeId });
    if (error) return 0;
    return typeof data === 'number' ? data : Number(data) || 0;
  } catch {
    return 0;
  }
}
