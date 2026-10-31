-- Etapa 8 (seguridad) · Restringe la LECTURA de la configuración de la tienda
-- (productos, respuestas rápidas, etiquetas, plantillas) al staff de esa tienda,
-- en vez de a cualquier usuario autenticado. Los clientes no autenticados ven
-- el catálogo vía la API de soporte (rol de servicio), que no usa estas policies.

create or replace function private.is_store_staff(p_store_id uuid)
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
        or (p.role in ('admin','agent') and p.store_id is not null and p.store_id = p_store_id)
      )
  );
$$;

drop policy if exists store_products_select_authed on public.store_products;
drop policy if exists store_products_select_staff on public.store_products;
create policy store_products_select_staff on public.store_products
  for select using (private.is_store_staff(store_id));

drop policy if exists store_quick_replies_select_authed on public.store_quick_replies;
drop policy if exists store_quick_replies_select_staff on public.store_quick_replies;
create policy store_quick_replies_select_staff on public.store_quick_replies
  for select using (private.is_store_staff(store_id));

drop policy if exists store_labels_select_authed on public.store_labels;
drop policy if exists store_labels_select_staff on public.store_labels;
create policy store_labels_select_staff on public.store_labels
  for select using (private.is_store_staff(store_id));

drop policy if exists store_message_templates_select_authed on public.store_message_templates;
drop policy if exists store_message_templates_select_staff on public.store_message_templates;
create policy store_message_templates_select_staff on public.store_message_templates
  for select using (private.is_store_staff(store_id));
