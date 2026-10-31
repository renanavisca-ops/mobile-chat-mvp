'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type TemplateOption = { id: string; label: string };

/** An interactive message template (text + tappable options). */
export type MessageTemplate = {
  id: string;
  storeId: string;
  title: string;
  body: string;
  options: TemplateOption[];
  sort: number;
};

function mapRow(r: any): MessageTemplate {
  const opts = Array.isArray(r.options) ? r.options : [];
  return {
    id: r.id,
    storeId: r.store_id,
    title: r.title,
    body: r.body,
    options: opts.map((o: any) => ({ id: String(o.id ?? crypto.randomUUID()), label: String(o.label ?? '') })).filter((o: TemplateOption) => o.label),
    sort: r.sort ?? 0,
  };
}

/** List a store's interactive templates (staff send them). */
export async function listTemplates(storeId: string): Promise<MessageTemplate[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('store_message_templates')
    .select('id, store_id, title, body, options, sort')
    .eq('store_id', storeId)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Create or update a template. RLS limits writes to store admins. */
export async function upsertTemplate(
  storeId: string,
  input: { id?: string; title: string; body: string; options: TemplateOption[]; sort?: number },
): Promise<void> {
  const supabase = browserSupabase();
  const row: any = {
    store_id: storeId,
    title: input.title.trim(),
    body: input.body.trim(),
    options: input.options.map((o) => ({ id: o.id, label: o.label.trim() })).filter((o) => o.label),
  };
  if (typeof input.sort === 'number') row.sort = input.sort;
  if (input.id) row.id = input.id;
  const { error } = await (supabase as any).from('store_message_templates').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a template. RLS limits this to store admins. */
export async function deleteTemplate(id: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).from('store_message_templates').delete().eq('id', id);
  if (error) throw error;
}
