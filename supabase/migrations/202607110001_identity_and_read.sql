-- Unique, case-insensitive usernames + let authenticated users read profiles
-- so people can search for and see each other (required for starting chats).

-- Case-insensitive unique username (Ana == ana == ANA)
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- Username format: 3-20 chars, letters/numbers/underscore (only enforced when set)
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');

-- Let authenticated users read profiles (needed for search + showing names).
-- INSERT/UPDATE remain self-only (existing policies).
drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles
  for select to authenticated using (true);

-- Availability check (case-insensitive), callable by signed-in users.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(candidate))
  );
$$;

revoke execute on function public.username_available(text) from anon;
grant execute on function public.username_available(text) to authenticated;
