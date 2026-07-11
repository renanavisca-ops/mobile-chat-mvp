-- Codifies objects that were previously created directly on the live database
-- (dashboard) but were missing from the repo, so a fresh provision reproduces
-- the working app. All statements are idempotent.

-- ---------- contacts ----------
create table if not exists public.contacts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);

alter table public.contacts enable row level security;

drop policy if exists "contacts_owner_read" on public.contacts;
create policy "contacts_owner_read" on public.contacts
  for select using (owner_id = auth.uid());

drop policy if exists "contacts_owner_write" on public.contacts;
create policy "contacts_owner_write" on public.contacts
  for insert with check (owner_id = auth.uid());

drop policy if exists "contacts_owner_delete" on public.contacts;
create policy "contacts_owner_delete" on public.contacts
  for delete using (owner_id = auth.uid());

-- ---------- chat_members: uniqueness + policies ----------
-- (primary key already enforces uniqueness; ensure membership policies exist)

-- Membership check as SECURITY DEFINER to avoid RLS recursion on chat_members.
create or replace function public.is_chat_member(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = p_user_id
  );
$$;

drop policy if exists "chat_members_select_member" on public.chat_members;
create policy "chat_members_select_member" on public.chat_members
  for select using (public.is_chat_member(chat_id, auth.uid()));

drop policy if exists "chat_members_insert_creator" on public.chat_members;
create policy "chat_members_insert_creator" on public.chat_members
  for insert with check (
    exists (select 1 from public.chats c where c.id = chat_members.chat_id and c.created_by = auth.uid())
  );

drop policy if exists "chat_members_delete_self" on public.chat_members;
create policy "chat_members_delete_self" on public.chat_members
  for delete using (user_id = auth.uid());

-- ---------- create_direct_chat / create_group_chat ----------
create or replace function public.create_direct_chat(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing uuid;
  new_chat uuid;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if other_user is null then raise exception 'other_user is required'; end if;
  if other_user = me then raise exception 'Cannot create direct chat with yourself'; end if;

  select c.id into existing
  from public.chats c
  where c.kind = 'direct'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = c.id
      group by cm.chat_id
      having count(*) = 2 and bool_and(cm.user_id in (me, other_user))
    )
  limit 1;

  if existing is not null then return existing; end if;

  insert into public.chats(kind, created_by, title)
  values ('direct', me, null)
  returning id into new_chat;

  insert into public.chat_members(chat_id, user_id)
  values (new_chat, me), (new_chat, other_user);

  return new_chat;
end;
$$;

create or replace function public.create_group_chat(title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_chat uuid;
  all_members uuid[];
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if title is null or length(trim(title)) = 0 then raise exception 'title is required'; end if;
  if member_ids is null or array_length(member_ids, 1) is null then raise exception 'member_ids is required'; end if;

  all_members := array(select distinct unnest(member_ids || array[me]));

  insert into public.chats(kind, created_by, title)
  values ('group', me, trim(title))
  returning id into new_chat;

  insert into public.chat_members(chat_id, user_id)
  select new_chat, m from unnest(all_members) as m;

  return new_chat;
end;
$$;
