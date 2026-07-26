-- Self-service 2FA recovery: one-time codes a user saves when enabling TOTP, so
-- a lost authenticator doesn't require an admin to remove the factor.
--
-- Only hashes are stored (SHA-256, uppercased + de-hyphenated). Generation and
-- consumption both happen server-side with the service role; clients can only
-- read their own rows (to show how many remain).

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_idx on public.mfa_recovery_codes (user_id);

alter table public.mfa_recovery_codes enable row level security;

-- Owner may read their own codes' metadata; there is intentionally no INSERT /
-- UPDATE / DELETE policy, so all writes must go through the service role.
drop policy if exists mfa_recovery_owner_read on public.mfa_recovery_codes;
create policy mfa_recovery_owner_read on public.mfa_recovery_codes
  for select using (user_id = auth.uid());
