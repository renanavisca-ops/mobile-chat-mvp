'use client';

import { browserSupabase } from '@/lib/supabase/client';

/** A product/service in a store's catalog. */
export type Product = {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  price: string | null;
  imagePath: string | null;
  active: boolean;
  sort: number;
};

/** Fields an admin edits when creating/updating a product. */
export type ProductInput = {
  id?: string;
  name: string;
  description: string | null;
  price: string | null;
  imagePath: string | null;
  active: boolean;
  sort?: number;
};

const BUCKET = 'catalog';

function mapRow(r: any): Product {
  return {
    id: r.id,
    storeId: r.store_id,
    name: r.name,
    description: r.description ?? null,
    price: r.price ?? null,
    imagePath: r.image_path ?? null,
    active: r.active !== false,
    sort: r.sort ?? 0,
  };
}

/** Public URL for a catalog image (the bucket is public). */
export function productImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  try {
    const supabase = browserSupabase();
    return supabase.storage.from(BUCKET).getPublicUrl(imagePath).data.publicUrl;
  } catch {
    return null;
  }
}

/** List a store's catalog (admins see inactive items too). */
export async function listProducts(storeId: string): Promise<Product[]> {
  const supabase = browserSupabase();
  const { data, error } = await (supabase as any)
    .from('store_products')
    .select('id, store_id, name, description, price, image_path, active, sort')
    .eq('store_id', storeId)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** Create or update a product. RLS limits writes to store admins. */
export async function upsertProduct(storeId: string, input: ProductInput): Promise<void> {
  const supabase = browserSupabase();
  const row: any = {
    store_id: storeId,
    name: input.name.trim(),
    description: (input.description ?? '').trim() || null,
    price: (input.price ?? '').trim() || null,
    image_path: input.imagePath,
    active: input.active,
  };
  if (typeof input.sort === 'number') row.sort = input.sort;
  if (input.id) row.id = input.id;
  const { error } = await (supabase as any)
    .from('store_products')
    .upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a product (and best-effort its image). */
export async function deleteProduct(product: Product): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await (supabase as any)
    .from('store_products')
    .delete()
    .eq('id', product.id);
  if (error) throw error;
  if (product.imagePath) {
    try { await supabase.storage.from(BUCKET).remove([product.imagePath]); } catch {}
  }
}

/** Upload a product image to the store's folder; returns its storage path. */
export async function uploadProductImage(storeId: string, file: File): Promise<string> {
  const supabase = browserSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}
