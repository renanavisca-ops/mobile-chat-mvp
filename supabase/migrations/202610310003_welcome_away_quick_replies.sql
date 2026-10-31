-- Etapa 7 · Mensajes de bienvenida/ausencia y respuestas rápidas.

-- Bienvenida y ausencia a nivel de tienda.
alter table public.stores add column if not exists welcome_message text;
alter table public.stores add column if not exists away_message text;
alter table public.stores add column if not exists away_active boolean not null default false;

-- Respuestas rápidas: frases predefinidas que el staff inserta en el chat.
create table if not exists public.store_quick_replies (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  title      text not null,
  body       text not null,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists store_quick_replies_store_idx on public.store_quick_replies (store_id, sort, created_at);

alter table public.store_quick_replies enable row level security;

-- Lectura: cualquier usuario autenticado (el staff las usa al responder).
drop policy if exists store_quick_replies_select_authed on public.store_quick_replies;
create policy store_quick_replies_select_authed on public.store_quick_replies
  for select using (auth.role() = 'authenticated');

-- Escritura: solo administradores de la tienda.
drop policy if exists store_quick_replies_write_admin on public.store_quick_replies;
create policy store_quick_replies_write_admin on public.store_quick_replies
  for all
  using (private.is_store_admin(store_id))
  with check (private.is_store_admin(store_id));
