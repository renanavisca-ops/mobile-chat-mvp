-- Make internal user discovery work by username or email.
-- Also removes and blocks self-contacts that were created by earlier broken flows.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id
  and p.email is null
  and u.email is not null;

create unique index if not exists profiles_email_lower_unique_idx
  on public.profiles (lower(email))
  where email is not null and btrim(email) <> '';

delete from public.contacts
where owner_id = contact_id;

alter table public.contacts
  drop constraint if exists contacts_no_self_check;

alter table public.contacts
  add constraint contacts_no_self_check
  check (owner_id <> contact_id);
