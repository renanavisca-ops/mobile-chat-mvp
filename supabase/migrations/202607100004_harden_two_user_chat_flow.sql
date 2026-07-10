-- Harden the two-user chat flow used by Contacts -> Direct Chat -> Messages.
-- This migration makes the RPCs versioned in the repo and adds defensive RLS policies.

-- Contacts are user-to-user, not device-to-device.
-- Ensure one contact edge per owner/contact pair.
create unique index if not exists contacts_owner_contact_unique_idx
  on public.contacts (owner_id, contact_id);

-- Useful indexes for chat/member lookups.
create index if not exists chat_members_user_id_idx
  on public.chat_members (user_id);

create index if not exists chat_members_chat_id_idx
  on public.chat_members (chat_id);

create index if not exists messages_chat_created_idx
  on public.messages (chat_id, created_at desc);

-- Direct-chat RPC used by src/lib/db/chats.ts.
-- Returns an existing direct chat between auth.uid() and other_user, or creates it.
create or replace function public.create_direct_chat(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  existing_chat_id uuid;
  new_chat_id uuid;
  other_username text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if other_user is null then
    raise exception 'other_user is required';
  end if;

  if other_user = current_user_id then
    raise exception 'Cannot create a direct chat with yourself';
  end if;

  -- Both users must exist as profiles. This prevents chats with auth users that are not usable contacts.
  if not exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'Current user profile not found';
  end if;

  select username into other_username
  from public.profiles
  where id = other_user;

  if other_username is null then
    raise exception 'Other user profile not found';
  end if;

  -- Find an existing direct chat whose member set contains both users.
  select cm1.chat_id
    into existing_chat_id
  from public.chat_members cm1
  join public.chat_members cm2 on cm2.chat_id = cm1.chat_id
  join public.chats c on c.id = cm1.chat_id
  where c.kind = 'direct'
    and cm1.user_id = current_user_id
    and cm2.user_id = other_user
  order by c.created_at desc
  limit 1;

  if existing_chat_id is not null then
    return existing_chat_id;
  end if;

  insert into public.chats (kind, created_by, title, assigned_to, status)
  values ('direct', current_user_id, other_username, current_user_id, 'open')
  returning id into new_chat_id;

  insert into public.chat_members (chat_id, user_id)
  values
    (new_chat_id, current_user_id),
    (new_chat_id, other_user)
  on conflict do nothing;

  return new_chat_id;
end;
$$;

grant execute on function public.create_direct_chat(uuid) to authenticated;

-- Group-chat RPC used by src/lib/db/chats.ts.
create or replace function public.create_group_chat(title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  new_chat_id uuid;
  clean_title text;
  member_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  clean_title := nullif(btrim(coalesce(title, '')), '');
  if clean_title is null then
    raise exception 'Group title required';
  end if;

  insert into public.chats (kind, created_by, title, assigned_to, status)
  values ('group', current_user_id, clean_title, current_user_id, 'open')
  returning id into new_chat_id;

  insert into public.chat_members (chat_id, user_id)
  values (new_chat_id, current_user_id)
  on conflict do nothing;

  foreach member_id in array coalesce(member_ids, array[]::uuid[]) loop
    if member_id is not null and member_id <> current_user_id then
      if exists (select 1 from public.profiles where id = member_id) then
        insert into public.chat_members (chat_id, user_id)
        values (new_chat_id, member_id)
        on conflict do nothing;
      end if;
    end if;
  end loop;

  return new_chat_id;
end;
$$;

grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

-- RLS hardening. Policies are intentionally simple and match the MVP behavior.
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.devices enable row level security;

-- Profiles: authenticated users can search profiles and manage their own profile.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Contacts: users can manage their own contact list.
drop policy if exists contacts_select_own on public.contacts;
create policy contacts_select_own
on public.contacts
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists contacts_insert_own on public.contacts;
create policy contacts_insert_own
on public.contacts
for insert
to authenticated
with check (owner_id = auth.uid() and contact_id <> auth.uid());

drop policy if exists contacts_delete_own on public.contacts;
create policy contacts_delete_own
on public.contacts
for delete
to authenticated
using (owner_id = auth.uid());

-- Chat members: users can read memberships for chats they belong to.
drop policy if exists chat_members_select_member_chats on public.chat_members;
create policy chat_members_select_member_chats
on public.chat_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.chat_members mine
    where mine.chat_id = chat_members.chat_id
      and mine.user_id = auth.uid()
  )
);

-- Chats: users can read chats where they are members, or assigned/created chats.
drop policy if exists chats_select_accessible on public.chats;
create policy chats_select_accessible
on public.chats
for select
to authenticated
using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = chats.id
      and cm.user_id = auth.uid()
  )
);

-- Chat inserts are mostly through security-definer RPCs; this still allows direct own inserts if needed.
drop policy if exists chats_insert_own on public.chats;
create policy chats_insert_own
on public.chats
for insert
to authenticated
with check (created_by = auth.uid() or assigned_to = auth.uid());

-- Messages: users can read/write messages in chats where they are members/assigned.
drop policy if exists messages_select_member_chat on public.messages;
create policy messages_select_member_chat
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = messages.chat_id
      and cm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.assigned_to = auth.uid()
  )
);

drop policy if exists messages_insert_member_chat on public.messages;
create policy messages_insert_member_chat
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = messages.chat_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists messages_update_member_chat on public.messages;
create policy messages_update_member_chat
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = messages.chat_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = messages.chat_id
      and cm.user_id = auth.uid()
  )
);

-- Devices: users can manage their own devices.
drop policy if exists devices_select_own on public.devices;
create policy devices_select_own
on public.devices
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists devices_insert_own on public.devices;
create policy devices_insert_own
on public.devices
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists devices_update_own on public.devices;
create policy devices_update_own
on public.devices
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
