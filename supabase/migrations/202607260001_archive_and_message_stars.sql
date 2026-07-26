-- Chat organisation: per-member archive flag + personal message stars.

-- 1) Archive a conversation for yourself only (mirrors chat_members.muted).
--    Archived chats drop out of the main list until a new message arrives or
--    the user opens the Archived view.
alter table public.chat_members
  add column if not exists archived boolean not null default false;

-- Toggle helper, mirroring set_chat_muted: direct updates to chat_members are
-- RLS-restricted, so flip the flag through a SECURITY DEFINER function scoped to
-- the caller's own membership row.
create or replace function public.set_chat_archived(p_chat_id uuid, p_archived boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_members
     set archived = p_archived
   where chat_id = p_chat_id
     and user_id = auth.uid();
$$;

revoke all on function public.set_chat_archived(uuid, boolean) from public;
grant execute on function public.set_chat_archived(uuid, boolean) to authenticated;

-- 2) Starred ("saved") messages, private to each user. A star is just a pointer
--    from a user to a message; the message row itself is unchanged.
create table if not exists public.message_stars (
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index if not exists message_stars_user_idx on public.message_stars (user_id, created_at desc);
create index if not exists message_stars_message_idx on public.message_stars (message_id);

alter table public.message_stars enable row level security;

-- Owner-only: you can only see and manage your own stars.
drop policy if exists message_stars_owner_all on public.message_stars;
create policy message_stars_owner_all on public.message_stars
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
