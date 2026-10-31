'use client';

import { browserSupabase } from '@/lib/supabase/client';

/** The commercial profile of a store (WhatsApp-Business-style). */
export type StoreProfile = {
  id: string;
  name: string;
  category: string | null;
  about: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  businessHours: string | null;
  welcomeMessage: string | null;
  awayMessage: string | null;
  awayActive: boolean;
};

/** The editable fields of a store's commercial profile. */
export type StoreProfileFields = {
  category: string | null;
  about: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  businessHours: string | null;
};

/** Automated greeting/away settings, edited separately from the profile. */
export type StoreAutoMessages = {
  welcomeMessage: string | null;
  awayMessage: string | null;
  awayActive: boolean;
};

// The business-profile columns aren't in the generated types yet, so the
// store queries are cast through `any`.
function mapRow(row: any): StoreProfile {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    about: row.about ?? null,
    address: row.address ?? null,
    website: row.website ?? null,
    phone: row.phone ?? null,
    businessHours: row.business_hours ?? null,
    welcomeMessage: row.welcome_message ?? null,
    awayMessage: row.away_message ?? null,
    awayActive: row.away_active === true,
  };
}

/** Load a store's commercial profile (readable by any authenticated user). */
export async function getStoreProfile(storeId: string): Promise<StoreProfile | null> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('stores')
    .select('id, name, category, about, address, website, phone, business_hours, welcome_message, away_message, away_active')
    .eq('id', storeId)
    .limit(1);
  if (error) throw error;
  const row = (data as any[])?.[0];
  return row ? mapRow(row) : null;
}

/** Update a store's automated greeting/away messages. RLS limits to admins. */
export async function updateStoreAutoMessages(storeId: string, m: StoreAutoMessages): Promise<void> {
  const supabase = browserSupabase();
  const norm = (v: string | null) => {
    const s = (v ?? '').trim();
    return s.length ? s : null;
  };
  const { error } = await (supabase as any)
    .from('stores')
    .update({
      welcome_message: norm(m.welcomeMessage),
      away_message: norm(m.awayMessage),
      away_active: !!m.awayActive,
    })
    .eq('id', storeId);
  if (error) throw error;
}

/** Update a store's commercial profile. RLS limits this to store admins. */
export async function updateStoreProfile(storeId: string, fields: StoreProfileFields): Promise<void> {
  const supabase = browserSupabase();
  // Normalize empty strings to null so cleared fields don't store blanks.
  const norm = (v: string | null) => {
    const s = (v ?? '').trim();
    return s.length ? s : null;
  };
  const { error } = await (supabase as any)
    .from('stores')
    .update({
      category: norm(fields.category),
      about: norm(fields.about),
      address: norm(fields.address),
      website: norm(fields.website),
      phone: norm(fields.phone),
      business_hours: norm(fields.businessHours),
    })
    .eq('id', storeId);
  if (error) throw error;
}
