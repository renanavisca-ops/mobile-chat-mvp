-- Align Supabase public.messages with the current MVP code path.
-- Required because internal agent messages, public customer messages, and system messages do not all have a device.

alter table public.messages
  add column if not exists content text;

-- Public chat customers and system messages are not authenticated devices.
alter table public.messages
  alter column sender_device_id drop not null;

-- All inserts should have a nonce. Keep existing NOT NULL behavior, but provide a DB default.
update public.messages
set nonce = gen_random_uuid()::text
where nonce is null;

alter table public.messages
  alter column nonce set default gen_random_uuid()::text;

alter table public.messages
  alter column nonce set not null;
