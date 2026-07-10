-- Harden Auth -> profiles -> contacts flow.
-- This migration prevents future profiles.username null/blank values, repairs existing rows,
-- backfills missing profiles from auth.users, and makes usernames searchable/unique.

create or replace function public.normalize_profile_username(input_username text, input_id uuid, force_suffix boolean default false)
returns text
language plpgsql
immutable
as $$
declare
  base text;
  suffix text;
begin
  suffix := left(replace(input_id::text, '-', ''), 8);

  base := lower(btrim(coalesce(input_username, '')));
  base := regexp_replace(base, '[^a-z0-9._-]+', '_', 'g');
  base := regexp_replace(base, '_+', '_', 'g');
  base := btrim(base, '_');

  if base is null or length(base) < 3 then
    return 'user_' || suffix;
  end if;

  if force_suffix then
    return left(base, 23) || '_' || suffix;
  end if;

  return left(base, 32);
end;
$$;

create or replace function public.ensure_profile_username()
returns trigger
language plpgsql
as $$
begin
  new.username := public.normalize_profile_username(new.username, new.id, false);
  if new.role is null or btrim(new.role) = '' then
    new.role := 'agent';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_profile_username_before_write on public.profiles;

create trigger ensure_profile_username_before_write
before insert or update on public.profiles
for each row
execute function public.ensure_profile_username();

-- Normalize existing profile usernames first.
update public.profiles
set username = public.normalize_profile_username(username, id, false),
    role = coalesce(nullif(btrim(role), ''), 'agent');

-- Resolve duplicates before creating the unique index.
with ranked as (
  select
    id,
    row_number() over (partition by lower(username) order by created_at nulls last, id) as rn
  from public.profiles
  where username is not null and btrim(username) <> ''
)
update public.profiles p
set username = public.normalize_profile_username(p.username, p.id, true)
from ranked r
where p.id = r.id
  and r.rn > 1;

-- Backfill missing public profiles for existing Supabase Auth users.
insert into public.profiles (id, username, role)
select
  u.id,
  public.normalize_profile_username(split_part(coalesce(u.email, ''), '@', 1), u.id, true),
  'agent'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- Auto-create public profile for future Auth users.
create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    public.normalize_profile_username(split_part(coalesce(new.email, ''), '@', 1), new.id, true),
    'agent'
  )
  on conflict (id) do update
  set username = public.normalize_profile_username(public.profiles.username, public.profiles.id, false),
      role = coalesce(nullif(btrim(public.profiles.role), ''), 'agent');

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile on auth.users;

create trigger on_auth_user_profile
after insert on auth.users
for each row
execute function public.handle_auth_user_profile();

-- DB-level guardrails. The BEFORE trigger fills blanks before this CHECK is evaluated.
alter table public.profiles
  drop constraint if exists profiles_username_not_blank;

alter table public.profiles
  add constraint profiles_username_not_blank
  check (username is not null and btrim(username) <> '');

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));
