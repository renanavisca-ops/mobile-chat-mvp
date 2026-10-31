-- Etapa 7 · Perfil comercial: campos del negocio sobre la tienda (store).
-- Un administrador de tienda puede describir su negocio (categoría, dirección,
-- horario, sitio web, teléfono, descripción) y esos datos se muestran al cliente
-- en el chat de soporte público.

alter table public.stores add column if not exists category text;
alter table public.stores add column if not exists about text;
alter table public.stores add column if not exists address text;
alter table public.stores add column if not exists website text;
alter table public.stores add column if not exists phone text;
alter table public.stores add column if not exists business_hours text;

-- ¿El usuario actual puede administrar esta tienda? superadmin siempre; admin
-- solo de su propia tienda. Los agentes no editan el perfil comercial.
create or replace function private.is_store_admin(p_store_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'superadmin'
        or (p.role = 'admin' and p.store_id is not null and p.store_id = p_store_id)
      )
  );
$$;

-- Solo los administradores de la tienda pueden editar su perfil comercial.
-- (El SELECT ya está permitido a cualquier usuario autenticado por
--  stores_select_authed, así que el cliente del chat de soporte puede verlo.)
drop policy if exists stores_update_admin on public.stores;
create policy stores_update_admin on public.stores
  for update
  using (private.is_store_admin(id))
  with check (private.is_store_admin(id));
