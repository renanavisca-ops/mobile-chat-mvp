-- RSVPs for in-chat events. An event is a normal message carrying
-- { event: { title, startsAt, ... } } in its payload; each member can set one
-- RSVP (going / maybe / no), mirrored to everyone live. Same shape and RLS as
-- poll_votes so the client can upsert it directly.
create table if not exists public.event_rsvps (
  message_id uuid not null references public.messages(id) on delete cascade,
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists event_rsvps_chat_idx on public.event_rsvps (chat_id);
create index if not exists event_rsvps_message_idx on public.event_rsvps (message_id);

alter table public.event_rsvps enable row level security;

create policy event_rsvps_select_member on public.event_rsvps
  for select using (
    private.is_chat_member(chat_id, (select auth.uid())) or private.is_store_staff_for_chat(chat_id)
  );

create policy event_rsvps_upsert_own on public.event_rsvps
  for insert with check (
    user_id = (select auth.uid())
    and (private.is_chat_member(chat_id, (select auth.uid())) or private.is_store_staff_for_chat(chat_id))
  );

create policy event_rsvps_update_own on public.event_rsvps
  for update using (user_id = (select auth.uid()));

create policy event_rsvps_delete_own on public.event_rsvps
  for delete using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.event_rsvps;
