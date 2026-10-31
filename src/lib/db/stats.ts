'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type AgentStat = { agentId: string; name: string; active: number; closed: number };

/** Support stats for a store (delivery/read/attention). */
export type StoreStats = {
  chatsOpen: number;
  chatsInProgress: number;
  chatsClosed: number;
  chatsTotal: number;
  customers: number;
  msgs7dTotal: number;
  msgs7dCustomer: number;
  msgs7dStaff: number;
  unreadCustomer: number;
  byAgent: AgentStat[];
};

const n = (v: any) => (typeof v === 'number' ? v : Number(v) || 0);

/** Load a store's support stats (store admins only; enforced in the RPC). */
export async function getStoreStats(storeId: string): Promise<StoreStats> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any).rpc('store_support_stats', { p_store_id: storeId });
  if (error) throw error;
  const d = (data ?? {}) as any;
  return {
    chatsOpen: n(d.chats_open),
    chatsInProgress: n(d.chats_in_progress),
    chatsClosed: n(d.chats_closed),
    chatsTotal: n(d.chats_total),
    customers: n(d.customers),
    msgs7dTotal: n(d.msgs_7d_total),
    msgs7dCustomer: n(d.msgs_7d_customer),
    msgs7dStaff: n(d.msgs_7d_staff),
    unreadCustomer: n(d.unread_customer),
    byAgent: Array.isArray(d.by_agent)
      ? d.by_agent.map((a: any) => ({ agentId: a.agent_id, name: a.name ?? '—', active: n(a.active), closed: n(a.closed) }))
      : [],
  };
}
