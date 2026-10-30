-- Consent for broadcast lists: recipients receive broadcasts by default but can
-- opt out. Delivery also always skips blocked relationships (already enforced
-- by the messages insert policy).
alter table public.profiles add column if not exists allow_broadcasts boolean not null default true;
