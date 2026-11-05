'use client';

import { browserSupabase } from '@/lib/supabase/client';

export type DeviceRow = { id: string; label: string | null; createdAt: string; current: boolean };

/** The device id this browser/app registered, if any. */
export function currentDeviceId(): string | null {
  try { return localStorage.getItem('active_device_id'); } catch { return null; }
}

/** List the account's registered devices, newest first, marking this one. */
export async function listMyDevices(): Promise<DeviceRow[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return [];
  const { data, error } = await supabase
    .from('devices')
    .select('id, device_label, created_at')
    .eq('user_id', me.user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const cur = currentDeviceId();
  return (data as any[]).map((d) => ({
    id: d.id as string,
    label: (d.device_label as string) ?? null,
    createdAt: d.created_at as string,
    current: d.id === cur,
  }));
}

/**
 * Revoke a device: delete its identity row. Messages keep (the FK is SET NULL),
 * but that device can no longer be used as a known sender until it re-registers.
 * Revoking the current device is disallowed here (use sign-out instead).
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  if (deviceId === currentDeviceId()) throw new Error('cannot revoke current device');
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error('Not authenticated');
  const { error } = await supabase.from('devices').delete().eq('id', deviceId).eq('user_id', me.user.id);
  if (error) throw error;
}

export type NewLogin = { id: string; label: string | null; createdAt: string };

/**
 * New-login access alerts: the account's devices that haven't been acknowledged
 * yet, excluding this one. Any of the user's devices can surface and clear them.
 * Only recent ones (30 days) are considered, so an old unacknowledged row never
 * nags forever.
 */
export async function listNewLogins(): Promise<NewLogin[]> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return [];
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await (supabase as any)
    .from('devices')
    .select('id, device_label, created_at, acknowledged')
    .eq('user_id', me.user.id)
    .eq('acknowledged', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  const cur = currentDeviceId();
  return ((data as any[]) || [])
    .filter((d) => d.id !== cur)
    .map((d) => ({ id: d.id as string, label: (d.device_label as string) ?? null, createdAt: d.created_at as string }));
}

/** Acknowledge (dismiss) one or all pending new-login alerts for the account. */
export async function acknowledgeLogins(deviceIds?: string[]): Promise<void> {
  const supabase = browserSupabase();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return;
  let q = (supabase as any).from('devices').update({ acknowledged: true }).eq('user_id', me.user.id).eq('acknowledged', false);
  if (deviceIds && deviceIds.length) q = q.in('id', deviceIds);
  await q;
}
