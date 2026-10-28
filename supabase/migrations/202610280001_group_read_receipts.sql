-- Per-member read receipts: a group message is only "read" once every other
-- member has seen it, and the sender can list exactly who has.
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reads_chat_idx on public.message_reads (chat_id);
create index if not exists message_reads_message_idx on public.message_reads (message_id);

alter table public.message_reads enable row level security;

-- Any member of the chat can see who read (so the sender gets the "seen by" list).
create policy message_reads_select_member on public.message_reads
  for select using (private.is_chat_member(chat_id, auth.uid()));

-- A user may only record their OWN read, and only in a chat they belong to.
create policy message_reads_insert_own on public.message_reads
  for insert with check (user_id = auth.uid() and private.is_chat_member(chat_id, auth.uid()));

-- When a read is recorded, flip the message to "read" ONLY once every other
-- member has read it; otherwise at least mark it delivered.
create or replace function public.on_message_read() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  member_cnt int;
  read_cnt int;
begin
  select count(*) into member_cnt from public.chat_members where chat_id = NEW.chat_id;
  select count(distinct user_id) into read_cnt from public.message_reads where message_id = NEW.message_id;
  if read_cnt >= member_cnt - 1 then
    update public.messages set read = true, delivery_status = 'read'
      where id = NEW.message_id and read = false;
  else
    update public.messages set delivery_status = 'delivered'
      where id = NEW.message_id and delivery_status = 'sent';
  end if;
  return NEW;
end; $$;

create or replace trigger trg_on_message_read after insert on public.message_reads
  for each row execute function public.on_message_read();

-- Record the caller's reads for every (non-system) message from others in a
-- group chat. The per-row trigger then advances each message's status.
create or replace function public.mark_group_read(p_chat_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_chat_member(p_chat_id, auth.uid()) then
    raise exception 'not a member';
  end if;
  insert into public.message_reads (message_id, chat_id, user_id)
  select m.id, m.chat_id, auth.uid()
  from public.messages m
  where m.chat_id = p_chat_id
    and m.sender_id is distinct from auth.uid()
    and coalesce(m.sender_type, 'user') <> 'system'
    and not exists (
      select 1 from public.message_reads r where r.message_id = m.id and r.user_id = auth.uid()
    )
  on conflict do nothing;
end; $$;

grant execute on function public.mark_group_read(uuid) to authenticated;

alter publication supabase_realtime add table public.message_reads;
