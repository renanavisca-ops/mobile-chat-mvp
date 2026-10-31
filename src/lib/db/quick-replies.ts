'use client';

import { browserSupabase } from '@/lib/supabase/client';

/** A canned reply staff can insert while answering a store chat. */
export type QuickReply = {
  id: string;
  storeId: string;
  title: string;
  body: string;
  sort: number;
};

function mapRow(r: any): QuickReply {
  return { id: r.id, storeId: r.store_id, title: r.title, body: r.body, sort: r.sort ?? 0 };
}

/** List a store's quick replies (any authenticated staff can read them). */
export async function listQuickReplies(storeId: string): Promise<QuickReply[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('store_quick_replies')
    .select('id, store_id, title, body, sort')
    .eq('store_id', storeId)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Create or update a quick reply. RLS limits writes to store admins. */
export async function upsertQuickReply(
  storeId: string,
  input: { id?: string; title: string; body: string; sort?: number },
): Promise<void> {
  const supabase = browserSupabase();
  const row: any = { store_id: storeId, title: input.title.trim(), body: input.body.trim() };
  if (typeof input.sort === 'number') row.sort = input.sort;
  if (input.id) row.id = input.id;
  const { error } = await (supabase as any)
    .from('store_quick_replies')
    .upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a quick reply. RLS limits this to store admins. */
export async function deleteQuickReply(id: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).from('store_quick_replies').delete().eq('id', id);
  if (error) throw error;
}
