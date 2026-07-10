-- Repair profiles that were auto-created with null/empty usernames.
-- Contacts search depends on profiles.username being searchable.

update public.profiles
set username = 'user_' || left(replace(id::text, '-', ''), 8)
where username is null or btrim(username) = '';

-- Optional hardening: prevent future blank usernames at DB level.
-- Keep this as a CHECK instead of NOT NULL because older code/schema allowed null.
alter table public.profiles
  drop constraint if exists profiles_username_not_blank;

alter table public.profiles
  add constraint profiles_username_not_blank
  check (username is not null and btrim(username) <> '');
