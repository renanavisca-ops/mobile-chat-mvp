-- Etapa 7 · Catálogo: productos/servicios de una tienda (nombre, descripción,
-- precio, imagen). Los administra el admin de la tienda y el cliente los ve en
-- el chat de soporte público.

create table if not exists public.store_products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  description text,
  price       text,            -- texto libre (ej. "$9.990", "USD 12.50")
  image_path  text,            -- ruta en el bucket público `catalog`
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists store_products_store_idx on public.store_products (store_id, sort, created_at);

alter table public.store_products enable row level security;

-- Lectura: cualquier usuario autenticado (el cliente no autenticado los ve vía
-- la API de soporte con rol de servicio).
drop policy if exists store_products_select_authed on public.store_products;
create policy store_products_select_authed on public.store_products
  for select using (auth.role() = 'authenticated');

-- Escritura: solo administradores de la tienda.
drop policy if exists store_products_write_admin on public.store_products;
create policy store_products_write_admin on public.store_products
  for all
  using (private.is_store_admin(store_id))
  with check (private.is_store_admin(store_id));

-- Bucket público para las imágenes del catálogo (lectura pública para el cliente).
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do nothing;

-- Subir/editar/borrar imágenes: solo el admin de la tienda, y solo dentro de la
-- carpeta de su tienda (la ruta es `<store_id>/<archivo>`). La lectura es pública
-- por el bucket.
drop policy if exists catalog_write_admin on storage.objects;
create policy catalog_write_admin on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'catalog'
    and private.is_store_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'catalog'
    and private.is_store_admin(((storage.foldername(name))[1])::uuid)
  );
