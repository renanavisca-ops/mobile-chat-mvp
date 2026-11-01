'use client';

import { browserSupabase } from '@/lib/supabase/client';
import type { MatchType } from '@/lib/automations/match';

/** An automation rule: keyword match → auto-reply and/or auto-label. */
export type AutomationRule = {
  id: string;
  storeId: string;
  name: string;
  enabled: boolean;
  matchType: MatchType;
  keywords: string[];
  caseSensitive: boolean;
  actionReply: string | null;
  actionLabelId: string | null;
  sort: number;
};

export type AutomationInput = {
  id?: string;
  name: string;
  enabled: boolean;
  matchType: MatchType;
  keywords: string[];
  caseSensitive: boolean;
  actionReply: string | null;
  actionLabelId: string | null;
  sort?: number;
};

function mapRow(r: any): AutomationRule {
  return {
    id: r.id,
    storeId: r.store_id,
    name: r.name,
    enabled: r.enabled !== false,
    matchType: (r.match_type ?? 'contains') as MatchType,
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    caseSensitive: !!r.case_sensitive,
    actionReply: r.action_reply ?? null,
    actionLabelId: r.action_label_id ?? null,
    sort: r.sort ?? 0,
  };
}

/** List a store's automation rules (staff can read; enforced by RLS). */
export async function listAutomationRules(storeId: string): Promise<AutomationRule[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('automation_rules')
    .select('id, store_id, name, enabled, match_type, keywords, case_sensitive, action_reply, action_label_id, sort')
    .eq('store_id', storeId)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Create or update a rule. RLS limits writes to store admins. */
export async function upsertAutomationRule(storeId: string, input: AutomationInput): Promise<void> {
  const supabase = browserSupabase();
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  const row: any = {
    store_id: storeId,
    name: input.name.trim(),
    enabled: input.enabled,
    match_type: input.matchType,
    keywords,
    case_sensitive: input.caseSensitive,
    action_reply: (input.actionReply ?? '').trim() || null,
    action_label_id: input.actionLabelId,
  };
  if (typeof input.sort === 'number') row.sort = input.sort;
  if (input.id) row.id = input.id;
  const { error } = await (supabase as any).from('automation_rules').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a rule. RLS limits this to store admins. */
export async function deleteAutomationRule(id: string): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any).from('automation_rules').delete().eq('id', id);
  if (error) throw error;
}
