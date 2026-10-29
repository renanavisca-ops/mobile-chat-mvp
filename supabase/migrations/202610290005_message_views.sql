-- "Ver una vez" (view-once) media: track who has opened a one-time photo/video.
-- A view-once message carries { viewOnce: true } in its payload; the recipient
-- can open the media exactly once. We record the open here so the lock survives
-- reloads and the sender can see whether it was opened.
create table if not exists public.message_views (
  message_id uuid not null references public.messages(id) on delete cascade,
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_views_chat_idx on public.message_views (chat_id);
create index if not exists message_views_message_idx on public.message_views (message_id);

alter table public.message_views enable row level security;

-- Any member of the chat can see the views (so the sender learns it was opened).
create policy message_views_select_member on public.message_views
  for select using (private.is_chat_member(chat_id, auth.uid()));

-- A user may only record their OWN view, and only in a chat they belong to.
create policy message_views_insert_own on public.message_views
  for insert with check (user_id = auth.uid() and private.is_chat_member(chat_id, auth.uid()));

-- Record that the caller opened a view-once message. The sender's own opens are
-- ignored (a sender can't "use up" their own view). Idempotent.
create or replace function public.mark_message_viewed(p_message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_chat uuid;
  v_sender uuid;
begin
  select chat_id, sender_id into v_chat, v_sender
  from public.messages where id = p_message_id;
  if v_chat is null then
    raise exception 'no such message';
  end if;
  if not private.is_chat_member(v_chat, auth.uid()) then
    raise exception 'not a member';
  end if;
  if v_sender is distinct from auth.uid() then
    insert into public.message_views (message_id, chat_id, user_id)
    values (p_message_id, v_chat, auth.uid())
    on conflict do nothing;
  end if;
end; $$;

grant execute on function public.mark_message_viewed(uuid) to authenticated;

alter publication supabase_realtime add table public.message_views;
