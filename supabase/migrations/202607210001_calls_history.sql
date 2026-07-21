-- Call history. The caller inserts one row per call; both the caller and the
-- callee (or group members) can read it via RLS, so the log shows on both ends.
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete set null,
  caller_id uuid not null references auth.users(id) on delete cascade,
  peer_id uuid references auth.users(id) on delete set null,
  is_video boolean not null default false,
  is_group boolean not null default false,
  answered boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists calls_caller_idx on public.calls (caller_id, started_at desc);
create index if not exists calls_peer_idx on public.calls (peer_id, started_at desc);

alter table public.calls enable row level security;

drop policy if exists calls_select on public.calls;
create policy calls_select on public.calls for select to authenticated
  using (
    caller_id = auth.uid()
    or peer_id = auth.uid()
    or (chat_id is not null and public.is_chat_member(chat_id, auth.uid()))
  );

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls for insert to authenticated
  with check (caller_id = auth.uid());

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls for update to authenticated
  using (caller_id = auth.uid() or peer_id = auth.uid())
  with check (caller_id = auth.uid() or peer_id = auth.uid());
