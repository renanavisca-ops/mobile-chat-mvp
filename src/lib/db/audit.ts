'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type AuditEntry = {
  id: number;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  actorId: string | null;
  targetId: string | null;
  actorName: string | null;
  targetName: string | null;
};

/** Recent audit entries for a store (store admins only; enforced by RLS). */
export async function getAuditLog(storeId: string, limit = 50): Promise<AuditEntry[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('audit_log')
    .select('id, action, detail, created_at, actor_id, target_id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data as any[]) ?? [];

  // Resolve actor/target display names in one batch.
  const ids = Array.from(new Set(rows.flatMap((r) => [r.actor_id, r.target_id]).filter(Boolean)));
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await (supabase as any)
      .from('profiles').select('id, username, display_name').in('id', ids);
    for (const p of (profs as any[]) ?? []) names.set(p.id, p.display_name || p.username || '—');
  }

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    detail: r.detail ?? null,
    createdAt: r.created_at,
    actorId: r.actor_id ?? null,
    targetId: r.target_id ?? null,
    actorName: r.actor_id ? names.get(r.actor_id) ?? null : null,
    targetName: r.target_id ? names.get(r.target_id) ?? null : null,
  }));
}
