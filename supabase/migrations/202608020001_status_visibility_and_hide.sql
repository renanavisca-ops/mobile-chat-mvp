-- Status (estado) visibility: broaden from "explicit contacts only" to "people
-- you chat with OR your contacts", and add a per-user hide list so a poster can
-- exclude specific people from seeing their status.

-- Who a user has hidden their status from.
create table if not exists public.status_hidden_from (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  hidden_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, hidden_id)
);

alter table public.status_hidden_from enable row level security;

-- The owner manages only their own hide list.
drop policy if exists status_hidden_select_own on public.status_hidden_from;
create policy status_hidden_select_own on public.status_hidden_from
  for select using (owner_id = (select auth.uid()));

drop policy if exists status_hidden_insert_own on public.status_hidden_from;
create policy status_hidden_insert_own on public.status_hidden_from
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists status_hidden_delete_own on public.status_hidden_from;
create policy status_hidden_delete_own on public.status_hidden_from
  for delete using (owner_id = (select auth.uid()));

create index if not exists status_hidden_from_hidden_idx on public.status_hidden_from (hidden_id);

-- Helper: does the current user share any chat with p_other? (definer so the
-- policy doesn't recurse into chat_members' own RLS)
create or replace function private.shares_chat_with(p_other uuid)
  returns boolean
  language sql
  security definer
  set search_path to 'public'
  set row_security to 'off'
as $$
  select exists (
    select 1
    from public.chat_members me
    join public.chat_members other on other.chat_id = me.chat_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_other
      and other.user_id <> me.user_id
  );
$$;

-- Helper: has p_author hidden their status from the current user?
create or replace function private.status_hidden_from_me(p_author uuid)
  returns boolean
  language sql
  security definer
  set search_path to 'public'
  set row_security to 'off'
as $$
  select exists (
    select 1 from public.status_hidden_from h
    where h.owner_id = p_author and h.hidden_id = (select auth.uid())
  );
$$;

grant execute on function private.shares_chat_with(uuid) to authenticated;
grant execute on function private.status_hidden_from_me(uuid) to authenticated;

-- Broaden visibility: your own status, plus authors who are your contact OR who
-- you share a chat with — minus anyone that author has hidden their status from.
drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
for select using (
  (expires_at > now())
  and (
    user_id = (select auth.uid())
    or (
      (
        exists (
          select 1 from public.contacts c
          where c.owner_id = (select auth.uid()) and c.contact_id = stories.user_id
        )
        or private.shares_chat_with(stories.user_id)
      )
      and not private.status_hidden_from_me(stories.user_id)
    )
  )
);
