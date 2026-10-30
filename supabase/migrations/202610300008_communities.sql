-- Communities: a named grouping of existing groups with central admin by the
-- creator (MVP). Links groups the creator administers; announcements can point
-- at one linked group.
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_url text,
  announcement_chat_id uuid references public.chats(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_groups (
  community_id uuid not null references public.communities(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (community_id, chat_id)
);

create index if not exists community_groups_chat_idx on public.community_groups (chat_id);

alter table public.communities enable row level security;
alter table public.community_groups enable row level security;

create policy communities_select on public.communities
  for select using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.community_groups cg
      join public.chat_members cm on cm.chat_id = cg.chat_id
      where cg.community_id = communities.id and cm.user_id = (select auth.uid())
    )
  );
create policy communities_insert on public.communities
  for insert with check (created_by = (select auth.uid()));
create policy communities_update on public.communities
  for update using (created_by = (select auth.uid()));
create policy communities_delete on public.communities
  for delete using (created_by = (select auth.uid()));

create policy community_groups_select on public.community_groups
  for select using (
    private.is_chat_member(chat_id, (select auth.uid()))
    or exists (select 1 from public.communities c where c.id = community_id and c.created_by = (select auth.uid()))
  );
create policy community_groups_insert on public.community_groups
  for insert with check (
    exists (select 1 from public.communities c where c.id = community_id and c.created_by = (select auth.uid()))
    and private.is_chat_admin(chat_id, (select auth.uid()))
  );
create policy community_groups_delete on public.community_groups
  for delete using (
    exists (select 1 from public.communities c where c.id = community_id and c.created_by = (select auth.uid()))
  );
