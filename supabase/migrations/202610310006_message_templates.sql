-- Etapa 7 · Mensajes interactivos: plantillas con opciones (botones/listas).
-- El admin define plantillas (texto + opciones tocables) y el staff las envía
-- a los clientes; el cliente toca una opción y se responde con esa etiqueta.

create table if not exists public.store_message_templates (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  title      text not null,
  body       text not null,
  options    jsonb not null default '[]'::jsonb,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists store_message_templates_store_idx on public.store_message_templates (store_id, sort, created_at);
alter table public.store_message_templates enable row level security;

drop policy if exists store_message_templates_select_authed on public.store_message_templates;
create policy store_message_templates_select_authed on public.store_message_templates
  for select using (auth.role() = 'authenticated');

drop policy if exists store_message_templates_write_admin on public.store_message_templates;
create policy store_message_templates_write_admin on public.store_message_templates
  for all
  using (private.is_store_admin(store_id))
  with check (private.is_store_admin(store_id));
