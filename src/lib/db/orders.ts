'use client';

import { browserSupabase } from '@/lib/supabase/client';

export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItem = { id: string; title: string; price: string | null; qty: number };
export type Order = {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
  chatId: string | null;
  items: OrderItem[];
};

/** Orders for a store (newest first). RLS restricts this to the store's staff. */
export async function listStoreOrders(storeId: string, status?: OrderStatus): Promise<Order[]> {
  const supabase = browserSupabase();
  let q = (supabase as any)
    .from('orders')
    .select('id, status, note, created_at, chat_id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  const orders = (data as any[]) ?? [];
  if (orders.length === 0) return [];

  const { data: itemsData } = await (supabase as any)
    .from('order_items')
    .select('id, order_id, title, price, qty')
    .in('order_id', orders.map((o) => o.id));

  const byOrder = new Map<string, OrderItem[]>();
  for (const it of (itemsData as any[]) ?? []) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push({ id: it.id, title: it.title, price: it.price ?? null, qty: it.qty });
    byOrder.set(it.order_id, arr);
  }

  return orders.map((o) => ({
    id: o.id,
    status: o.status as OrderStatus,
    note: o.note ?? null,
    createdAt: o.created_at,
    chatId: o.chat_id ?? null,
    items: byOrder.get(o.id) ?? [],
  }));
}

/** Update an order's status (store staff only, enforced by RLS). */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await (browserSupabase() as any)
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}
