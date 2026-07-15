'use client';

import { browserSupabase } from '@/lib/supabase/client';

/**
 * In-chat payments — SCAFFOLD ONLY.
 *
 * The database table `payments` and its RLS exist, and `/api/payments/checkout`
 * is stubbed. No processor is wired yet. When you add one (e.g. Stripe):
 *   1. Implement the checkout route to create a PaymentIntent + insert a
 *      `payments` row (status 'pending') with the service role.
 *   2. Add a webhook route to flip status to 'succeeded'/'failed'.
 *   3. Build the UI (a "Send money" entry in the attach sheet) that calls
 *      `startCheckout()` below and handles the returned client secret / URL.
 */

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'canceled';

export type Payment = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  chat_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
};

export type CheckoutRequest = {
  recipientId: string;
  chatId: string;
  amountCents: number;
  currency?: string;
};

/**
 * Kick off a checkout. Returns whatever the provider needs on the client
 * (client secret / redirect URL). Currently returns { configured: false }
 * because no processor is wired.
 */
export async function startCheckout(
  input: CheckoutRequest
): Promise<{ configured: false } | { configured: true; clientSecret?: string; url?: string }> {
  const supabase = browserSupabase();
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/payments/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token}`,
    },
    body: JSON.stringify(input),
  });
  if (res.status === 501) return { configured: false };
  if (!res.ok) throw new Error('Checkout failed');
  return { configured: true, ...(await res.json()) };
}

/** List payments the current user sent or received. */
export async function listMyPayments(): Promise<Payment[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Payment[];
}
