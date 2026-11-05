'use client';

import { useEffect, useState } from 'react';
import { useT, useFormatters } from '@/lib/i18n/context';
import { browserSupabase } from '@/lib/supabase/client';
import { listStoreOrders, updateOrderStatus, ORDER_STATUSES, type Order, type OrderStatus } from '@/lib/db/orders';

/**
 * Store orders received from the catalog (§12). Only rendered for store staff.
 * Lists orders newest-first with their items and lets staff advance the status.
 */
export function OrdersSettings() {
  const t = useT();
  const fmts = useFormatters();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = browserSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) { if (alive) setLoading(false); return; }
        const { data } = await (supabase as any).from('profiles').select('role, store_id').eq('id', user.id).limit(1);
        const prof = (data as any[])?.[0];
        const isStaff = prof && prof.store_id && ['agent', 'admin', 'superadmin'].includes(prof.role);
        if (!isStaff) { if (alive) setLoading(false); return; }
        if (alive) setStoreId(prof.store_id);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function reload(id: string) {
    try { setOrders(await listStoreOrders(id)); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (storeId && open) reload(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, open]);

  if (loading || !storeId) return null;

  async function changeStatus(orderId: string, status: OrderStatus) {
    setBusyId(orderId);
    try {
      await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch { /* ignore */ } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left">
        <div>
          <div className="text-sm font-semibold text-slate-100">{t('orders.title')}</div>
          <div className="mt-0.5 text-xs text-slate-400">{t('orders.desc')}</div>
        </div>
        <span className="shrink-0 text-slate-500">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-slate-500">{t('orders.empty')}</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-slate-500">{fmts.dateTime(new Date(o.createdAt))}</div>
                  <select
                    value={o.status}
                    disabled={busyId === o.id}
                    onChange={(e) => changeStatus(o.id, e.target.value as OrderStatus)}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`orders.status_${s}`)}</option>
                    ))}
                  </select>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-slate-200">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span className="truncate">{it.qty}× {it.title}</span>
                      {it.price && <span className="shrink-0 text-emerald-300">{it.price}</span>}
                    </li>
                  ))}
                </ul>
                {o.note && <p className="mt-1 text-xs text-slate-400">📝 {o.note}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
