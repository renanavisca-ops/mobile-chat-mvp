'use client';

import { apiFetch } from '@/lib/api/client';
import { browserSupabase } from '@/lib/supabase/client';

async function authHeader() {
  const { data } = await browserSupabase().auth.getSession();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` };
}

export type PhoneRequestResult =
  | { ok: true; simulated: boolean; simulatedCode?: string }
  | { ok: false; code: string };

/** Request a verification code for `phone`. Returns {ok:false,code} when the
 *  feature is disabled (501) — it's off by default and only the local simulator
 *  is implemented (see docs/PHONE.md). */
export async function requestPhoneCode(phone: string): Promise<PhoneRequestResult> {
  const res = await apiFetch('/api/phone/request', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ phone }) });
  if (res.ok) return { ok: true, ...(await res.json()) };
  const j = await res.json().catch(() => ({}));
  return { ok: false, code: (j as any).code || 'error' };
}

export type PhoneVerifyResult = { ok: true; phone: string } | { ok: false; code: string };

export async function verifyPhoneCode(code: string): Promise<PhoneVerifyResult> {
  const res = await apiFetch('/api/phone/verify', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ code }) });
  if (res.ok) return { ok: true, ...(await res.json()) };
  const j = await res.json().catch(() => ({}));
  return { ok: false, code: (j as any).code || 'error' };
}

/** The current account's phone and whether it's verified. */
export async function getMyPhone(): Promise<{ phone: string | null; verified: boolean }> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return { phone: null, verified: false };
  const { data } = await (supabase as any).from('profiles').select('phone, phone_verified').eq('id', me.user.id).maybeSingle();
  return { phone: (data as any)?.phone ?? null, verified: !!(data as any)?.phone_verified };
}
