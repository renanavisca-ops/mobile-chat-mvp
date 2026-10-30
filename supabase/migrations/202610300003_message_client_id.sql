-- Idempotency key for outgoing messages so an offline-queue retry that already
-- landed on the server doesn't create a duplicate. The client generates a
-- stable client_id per message and reuses it across retries; a unique index on
-- (sender_id, client_id) turns a repeat insert into ON CONFLICT DO NOTHING.
-- NULLs are allowed and distinct, so legacy/system inserts are unaffected.
alter table public.messages add column if not exists client_id uuid;

create unique index if not exists messages_sender_client_uidx
  on public.messages (sender_id, client_id);
