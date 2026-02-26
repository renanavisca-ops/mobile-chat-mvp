create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  registration_id integer not null,
  identity_public_key text not null,
  signed_prekey_id integer not null,
  signed_prekey_public text not null,
  signed_prekey_signature text not null,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.prekeys (
  id bigserial primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  prekey_id integer not null,
  public_key text not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(device_id, prekey_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  created_by uuid not null references auth.users(id),
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_device_id uuid not null references public.devices(id),
  message_type text not null check (message_type in ('prekey', 'whisper')),
  ciphertext text not null,
  nonce text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  cipher_blob_path text not null,
  media_type text not null,
  file_size_bytes integer not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.prekeys enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;

create policy "profiles_self_select" on public.profiles for select using (id = auth.uid());
create policy "profiles_self_upsert" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "devices_owner_all" on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "prekeys_owner_access" on public.prekeys
for all using (
  exists (
    select 1 from public.devices d
    where d.id = prekeys.device_id and d.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.devices d
    where d.id = prekeys.device_id and d.user_id = auth.uid()
  )
);

create policy "chats_member_select" on public.chats
for select using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chats.id and cm.user_id = auth.uid()
  )
);

create policy "chats_create" on public.chats
for insert with check (created_by = auth.uid());

create policy "chat_members_member_read" on public.chat_members
for select using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat_members.chat_id and cm.user_id = auth.uid()
  )
);

create policy "chat_members_owner_insert" on public.chat_members
for insert with check (
  exists (
    select 1 from public.chats c
    where c.id = chat_members.chat_id and c.created_by = auth.uid()
  )
);

create policy "messages_member_read" on public.messages
for select using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = messages.chat_id and cm.user_id = auth.uid()
  )
);

create policy "messages_member_insert" on public.messages
for insert with check (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = messages.chat_id and cm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.devices d
    where d.id = sender_device_id and d.user_id = auth.uid()
  )
);

create policy "attachments_member_read" on public.attachments
for select using (
  exists (
    select 1
    from public.messages m
    join public.chat_members cm on cm.chat_id = m.chat_id
    where m.id = attachments.message_id and cm.user_id = auth.uid()
  )
);

create publication supabase_realtime_messages for table public.messages;
