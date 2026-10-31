-- Etapa 7 · Etiquetas para clientes y conversaciones (estilo WhatsApp Business).

-- Definiciones de etiquetas por tienda (las administra el admin).
create table if not exists public.store_labels (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  color      text,            -- token de color (indigo/emerald/amber/rose/sky/violet/slate)
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists store_labels_store_idx on public.store_labels (store_id, sort, created_at);
alter table public.store_labels enable row level security;

drop policy if exists store_labels_select_authed on public.store_labels;
create policy store_labels_select_authed on public.store_labels
  for select using (auth.role() = 'authenticated');

drop policy if exists store_labels_write_admin on public.store_labels;
create policy store_labels_write_admin on public.store_labels
  for all
  using (private.is_store_admin(store_id))
  with check (private.is_store_admin(store_id));

-- Etiquetas aplicadas a una conversación (el staff las pone/quita).
create table if not exists public.chat_labels (
  chat_id    uuid not null references public.chats(id) on delete cascade,
  label_id   uuid not null references public.store_labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, label_id)
);
create index if not exists chat_labels_chat_idx on public.chat_labels (chat_id);
create index if not exists chat_labels_label_idx on public.chat_labels (label_id);
alter table public.chat_labels enable row level security;

-- Lectura y escritura: el staff de la tienda dueña del chat.
drop policy if exists chat_labels_select_staff on public.chat_labels;
create policy chat_labels_select_staff on public.chat_labels
  for select using (private.is_store_staff_for_chat(chat_id));

drop policy if exists chat_labels_write_staff on public.chat_labels;
create policy chat_labels_write_staff on public.chat_labels
  for all
  using (private.is_store_staff_for_chat(chat_id))
  with check (private.is_store_staff_for_chat(chat_id));
