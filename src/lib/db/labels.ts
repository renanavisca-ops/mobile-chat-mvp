'use client';

import { browserSupabase } from '@/lib/supabase/client';

/** A conversation label defined by a store. */
export type Label = {
  id: string;
  storeId: string;
  name: string;
  color: string | null;
  sort: number;
};

/** Preset colors. Tailwind needs literal class names, so these are static. */
export const LABEL_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'slate'] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

const CHIP: Record<string, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/40',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
  sky: 'bg-sky-500/15 text-sky-300 ring-sky-500/40',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/40',
  slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/40',
};
const DOT: Record<string, string> = {
  indigo: 'bg-indigo-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400',
  rose: 'bg-rose-400', sky: 'bg-sky-400', violet: 'bg-violet-400', slate: 'bg-slate-400',
};

/** Tailwind classes for a label chip. */
export function labelChipClasses(color: string | null): string {
  return CHIP[color ?? 'slate'] ?? CHIP.slate;
}
/** Tailwind classes for a small color dot. */
export function labelDotClasses(color: string | null): string {
  return DOT[color ?? 'slate'] ?? DOT.slate;
}

function mapRow(r: any): Label {
  return { id: r.id, storeId: r.store_id, name: r.name, color: r.color ?? null, sort: r.sort ?? 0 };
}

/** List a store's label definitions. */
export async function listLabels(storeId: string): Promise<Label[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('store_labels')
    .select('id, store_id, name, color, sort')
    .eq('store_id', storeId)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Create or update a label definition. RLS limits writes to store admins. */
export async function upsertLabel(
  storeId: string,
  input: { id?: string; name: string; color: string | null; sort?: number },
): Promise<void> {
  const supabase = browserSupabase();
  const row: any = { store_id: storeId, name: input.name.trim(), color: input.color };
  if (typeof input.sort === 'number') row.sort = input.sort;
  if (input.id) row.id = input.id;
  const { error } = await (supabase as any).from('store_labels').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a label definition (also removes it from every chat). */
export async function deleteLabel(id: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).from('store_labels').delete().eq('id', id);
  if (error) throw error;
}

/** The label ids applied to a chat. */
export async function getChatLabelIds(chatId: string): Promise<string[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('chat_labels')
    .select('label_id')
    .eq('chat_id', chatId);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => r.label_id as string);
}

/** Apply a label to a chat (idempotent). */
export async function addChatLabel(chatId: string, labelId: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any)
    .from('chat_labels')
    .upsert({ chat_id: chatId, label_id: labelId }, { onConflict: 'chat_id,label_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Remove a label from a chat. */
export async function removeChatLabel(chatId: string, labelId: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any)
    .from('chat_labels')
    .delete()
    .eq('chat_id', chatId)
    .eq('label_id', labelId);
  if (error) throw error;
}
