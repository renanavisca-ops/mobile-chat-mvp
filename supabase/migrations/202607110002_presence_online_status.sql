-- Online presence: persisted last_seen + a "hide my online status" toggle.

alter table public.profiles
  add column if not exists last_seen timestamptz,
  add column if not exists show_online boolean not null default true;

-- Heartbeat: mark the current user as recently seen
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

revoke execute on function public.touch_last_seen() from anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Ensure realtime is enabled for the tables the app subscribes to
do $$
begin
  begin alter publication supabase_realtime add table public.chat_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chats; exception when duplicate_object then null; end;
end $$;
