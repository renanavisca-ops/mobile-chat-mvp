-- Privacy restrictions: who can add me to groups, and who can call me.
-- group_add_policy: 'everyone' | 'contacts' | 'nobody'
-- calls_policy:     'everyone' | 'contacts'   (enforced client-side on the callee)
alter table public.profiles add column if not exists group_add_policy text not null default 'everyone';
alter table public.profiles add column if not exists calls_policy text not null default 'everyone';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_group_add_policy_chk') then
    alter table public.profiles add constraint profiles_group_add_policy_chk
      check (group_add_policy in ('everyone', 'contacts', 'nobody'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_calls_policy_chk') then
    alter table public.profiles add constraint profiles_calls_policy_chk
      check (calls_policy in ('everyone', 'contacts'));
  end if;
end $$;

-- Enforce the group-add policy at the row level so it covers every path that
-- inserts members (direct client insert AND the SECURITY DEFINER create RPC).
-- A disallowed add is silently skipped (BEFORE INSERT returning NULL) so one
-- restricted member never fails a whole group creation.
create or replace function public.enforce_group_add_policy() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text;
  v_policy text;
begin
  -- Self-joins (channels, creator adding self, accepting an invite) always pass.
  if NEW.user_id = auth.uid() then return NEW; end if;
  select kind into v_kind from public.chats where id = NEW.chat_id;
  -- Only group chats are gated; direct chats and channels are unaffected.
  if v_kind is distinct from 'group' then return NEW; end if;
  select coalesce(group_add_policy, 'everyone') into v_policy
    from public.profiles where id = NEW.user_id;
  if v_policy = 'everyone' then return NEW; end if;
  if v_policy = 'contacts' and exists (
    select 1 from public.contacts where owner_id = NEW.user_id and contact_id = auth.uid()
  ) then
    return NEW;
  end if;
  -- 'nobody', or 'contacts' without the adder in the target's contacts → skip.
  return null;
end; $$;

create or replace trigger trg_enforce_group_add_policy
  before insert on public.chat_members
  for each row execute function public.enforce_group_add_policy();
