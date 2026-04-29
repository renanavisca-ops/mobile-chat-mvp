-- 1. Crear tabla stores
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null check (country in ('GT', 'CR')),
  active boolean default true,
  created_at timestamptz not null default now()
);

-- 2. Modificar profiles
alter table public.profiles 
  add column if not exists store_id uuid references public.stores(id),
  add column if not exists role text check (role in ('agent', 'admin', 'superadmin')) default 'agent';

-- 3. Modificar chats
alter table public.chats 
  add column if not exists store_id uuid references public.stores(id),
  add column if not exists assigned_to uuid references auth.users(id),
  add column if not exists status text check (status in ('open', 'in_progress', 'closed')) default 'open';


-- 4. Modificar messages
alter table public.messages 
  add column if not exists read boolean default false,
  add column if not exists content text,
  alter column sender_device_id drop not null,
  alter column ciphertext drop not null,
  alter column nonce drop not null;

-- Actualizar check de message_type
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check check (message_type in ('prekey', 'whisper', 'system'));

-- Permitir created_by nulo en chats (para clientes externos)
alter table public.chats alter column created_by drop not null;


-- 5. Crear índices
create index if not exists idx_chats_store_id on public.chats(store_id);
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_profiles_store_id on public.profiles(store_id);

-- 6. Activar RLS y crear políticas (Asegurarse de que RLS está habilitado)
alter table public.stores enable row level security;

-- Políticas para Stores
create policy "stores_select_all" on public.stores for select using (true);

-- Actualizar Políticas de Chats para Multi-tenancy
drop policy if exists "chats_member_select" on public.chats;
drop policy if exists "chats_create" on public.chats;

-- Acceso total para superadmin
create policy "superadmin_chats_all" on public.chats
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

-- Admin: ve todos los chats de su tienda
create policy "admin_chats_store_select" on public.chats
  for select using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and (role = 'admin' or role = 'agent')
      and store_id = chats.store_id
    )
  );

-- Agent: solo ve chats donde es miembro (o de su tienda según el requerimiento)
-- El requerimiento dice: "agent: solo ve chats donde chats.store_id = profiles.store_id"
-- Pero usualmente es mejor si solo ve los asignados o donde es miembro.
-- Seguiré el requerimiento literal:
create policy "agent_chats_store_select" on public.chats
  for select using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and store_id = chats.store_id
    )
  );

-- Políticas para Mensajes filtrados por tienda (vía chat)
drop policy if exists "messages_member_read" on public.messages;

create policy "messages_store_read" on public.messages
  for select using (
    exists (
      select 1 from public.chats c
      join public.profiles p on p.store_id = c.store_id
      where c.id = messages.chat_id and p.id = auth.uid()
    ) or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'superadmin'
    )
  );
