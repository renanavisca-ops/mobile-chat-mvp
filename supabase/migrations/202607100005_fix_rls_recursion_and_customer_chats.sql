-- Fix RLS recursion introduced by membership policies and support stable direct/customer chat behavior.

-- Stable direct-chat identity for API-created internal direct chats.
alter table public.chats
  add column if not exists direct_key text;

create unique index if not exists chats_direct_key_unique_idx
  on public.chats (direct_key)
  where kind = 'direct' and direct_key is not null;

-- Helper avoids recursive RLS on chat_members policies.
create or replace function public.is_chat_member(target_chat_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_members cm
    where cm.chat_id = target_chat_id
      and cm.user_id = target_user_id
  );
$$;

grant execute on function public.is_chat_member(uuid, uuid) to authenticated;

-- Keep policies deterministic and non-recursive.
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.devices enable row level security;

-- Profiles
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Contacts
DROP POLICY IF EXISTS contacts_select_own ON public.contacts;
CREATE POLICY contacts_select_own
ON public.contacts
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS contacts_insert_own ON public.contacts;
CREATE POLICY contacts_insert_own
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid() and contact_id <> auth.uid());

DROP POLICY IF EXISTS contacts_delete_own ON public.contacts;
CREATE POLICY contacts_delete_own
ON public.contacts
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Chat members: non-recursive membership access.
DROP POLICY IF EXISTS chat_members_select_member_chats ON public.chat_members;
CREATE POLICY chat_members_select_member_chats
ON public.chat_members
FOR SELECT
TO authenticated
USING (public.is_chat_member(chat_id, auth.uid()));

DROP POLICY IF EXISTS chat_members_insert_own_or_rpc ON public.chat_members;
CREATE POLICY chat_members_insert_own_or_rpc
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Chats
DROP POLICY IF EXISTS chats_select_accessible ON public.chats;
CREATE POLICY chats_select_accessible
ON public.chats
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_chat_member(id, auth.uid())
);

DROP POLICY IF EXISTS chats_insert_own ON public.chats;
CREATE POLICY chats_insert_own
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS chats_update_accessible ON public.chats;
CREATE POLICY chats_update_accessible
ON public.chats
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_chat_member(id, auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.is_chat_member(id, auth.uid())
);

-- Messages
DROP POLICY IF EXISTS messages_select_member_chat ON public.messages;
CREATE POLICY messages_select_member_chat
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS messages_insert_member_chat ON public.messages;
CREATE POLICY messages_insert_member_chat
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_chat_member(chat_id, auth.uid())
);

DROP POLICY IF EXISTS messages_update_member_chat ON public.messages;
CREATE POLICY messages_update_member_chat
ON public.messages
FOR UPDATE
TO authenticated
USING (
  public.is_chat_member(chat_id, auth.uid())
  OR exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.is_chat_member(chat_id, auth.uid())
  OR exists (
    select 1
    from public.chats c
    where c.id = messages.chat_id
      and c.assigned_to = auth.uid()
  )
);

-- Devices
DROP POLICY IF EXISTS devices_select_own ON public.devices;
CREATE POLICY devices_select_own
ON public.devices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS devices_insert_own ON public.devices;
CREATE POLICY devices_insert_own
ON public.devices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS devices_update_own ON public.devices;
CREATE POLICY devices_update_own
ON public.devices
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
