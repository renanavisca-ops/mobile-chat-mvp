-- Group roles (creator/admin/member) and group permissions.
-- NOTE: written DROP-free (ALTER POLICY / CREATE OR REPLACE) because DROP hangs
-- against this project via the pooled DDL path.

-- Roles -----------------------------------------------------------------------
alter table public.chat_members add column if not exists role text not null default 'member';
update public.chat_members cm set role = 'admin'
  from public.chats c
  where c.id = cm.chat_id and c.kind = 'group' and c.created_by = cm.user_id and cm.role <> 'admin';

-- Permissions ('all' = any member, 'admins' = admins only) --------------------
alter table public.chats add column if not exists perm_edit text not null default 'admins';
alter table public.chats add column if not exists perm_add  text not null default 'admins';
alter table public.chats add column if not exists perm_send text not null default 'all';

-- Helpers ---------------------------------------------------------------------
create or replace function private.is_chat_admin(p_chat_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.chats c where c.id = p_chat_id and c.created_by = p_user_id)
      or exists(select 1 from public.chat_members cm where cm.chat_id = p_chat_id and cm.user_id = p_user_id and cm.role = 'admin');
$$;

create or replace function private.can_edit_group(p_chat_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select private.is_chat_admin(p_chat_id, p_user_id)
      or exists (select 1 from public.chats c where c.id = p_chat_id and c.kind = 'group' and c.perm_edit = 'all'
                   and private.is_chat_member(p_chat_id, p_user_id));
$$;

-- Policies --------------------------------------------------------------------
-- Add members: admins always; any member when perm_add='all'; self-join to public channels.
alter policy chat_members_insert on public.chat_members
  with check (
    private.is_chat_admin(chat_id, (select auth.uid()))
    or (
      exists (select 1 from public.chats c where c.id = chat_members.chat_id and c.kind = 'group' and c.perm_add = 'all')
      and private.is_chat_member(chat_id, (select auth.uid()))
    )
    or (
      user_id = (select auth.uid())
      and exists (select 1 from public.chats c where c.id = chat_members.chat_id and c.kind = 'channel' and c.is_public)
    )
  );

-- Send: in a group set to admins-only, non-admins can't post normal messages.
-- System rows (call logs, group events) are exempt.
alter policy messages_insert_member_or_staff on public.messages
  with check (
    (private.is_chat_member(chat_id, (select auth.uid())) or private.is_store_staff_for_chat(chat_id))
    and not exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.user_id <> (select auth.uid()) and is_blocked((select auth.uid()), cm.user_id)
    )
    and (
      not exists (select 1 from public.chats c where c.id = messages.chat_id and c.kind = 'channel')
      or exists (select 1 from public.chats c where c.id = messages.chat_id and c.kind = 'channel' and c.created_by = (select auth.uid()))
    )
    and (
      message_type = 'system'
      or not exists (select 1 from public.chats c where c.id = messages.chat_id and c.kind = 'group' and c.perm_send = 'admins')
      or private.is_chat_admin(messages.chat_id, (select auth.uid()))
    )
  );

-- Permission-aware edit RPCs --------------------------------------------------
create or replace function public.update_group_info(p_chat_id uuid, p_title text, p_description text)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text := trim(p_title); v_desc text := nullif(trim(coalesce(p_description,'')),'');
begin
  if v_title = '' or length(v_title) > 60 then raise exception 'Title must be 1-60 characters'; end if;
  if v_desc is not null and length(v_desc) > 500 then raise exception 'Description must be 500 characters or fewer'; end if;
  if not private.can_edit_group(p_chat_id, auth.uid()) then raise exception 'Not allowed to edit this group'; end if;
  update public.chats set title = v_title, description = v_desc where id = p_chat_id;
end; $$;

create or replace function public.rename_group_chat(p_chat_id uuid, p_title text)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text := trim(p_title);
begin
  if v_title = '' or length(v_title) > 60 then raise exception 'Title must be 1-60 characters'; end if;
  if not private.can_edit_group(p_chat_id, auth.uid()) then raise exception 'Not allowed to rename this group'; end if;
  update public.chats set title = v_title where id = p_chat_id;
end; $$;

create or replace function public.set_group_avatar(p_chat_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.can_edit_group(p_chat_id, auth.uid()) then raise exception 'Not allowed to edit this group'; end if;
  update public.chats set avatar_url = p_url where id = p_chat_id;
end; $$;

create or replace function public.remove_group_member(p_chat_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_chat_admin(p_chat_id, auth.uid()) then raise exception 'Only admins can remove members'; end if;
  if p_member_id = auth.uid() then raise exception 'Use leave instead of removing yourself'; end if;
  if exists (select 1 from public.chats where id = p_chat_id and created_by = p_member_id) then
    raise exception 'The group creator cannot be removed'; end if;
  delete from public.chat_members where chat_id = p_chat_id and user_id = p_member_id;
end; $$;

create or replace function public.set_group_role(p_chat_id uuid, p_member_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('admin','member') then raise exception 'Invalid role'; end if;
  if not private.is_chat_admin(p_chat_id, auth.uid()) then raise exception 'Only admins can change roles'; end if;
  if exists (select 1 from public.chats where id = p_chat_id and created_by = p_member_id) then
    raise exception 'The group creator is always an admin'; end if;
  update public.chat_members set role = p_role where chat_id = p_chat_id and user_id = p_member_id;
  if not found then raise exception 'Not a member'; end if;
end; $$;

create or replace function public.set_group_perms(p_chat_id uuid, p_edit text, p_add text, p_send text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_chat_admin(p_chat_id, auth.uid()) then raise exception 'Only admins can change permissions'; end if;
  if p_edit not in ('all','admins') or p_add not in ('all','admins') or p_send not in ('all','admins') then
    raise exception 'Invalid permission value'; end if;
  update public.chats set perm_edit = p_edit, perm_add = p_add, perm_send = p_send where id = p_chat_id and kind = 'group';
end; $$;

grant execute on function public.set_group_avatar(uuid,text) to authenticated;
grant execute on function public.set_group_role(uuid,uuid,text) to authenticated;
grant execute on function public.set_group_perms(uuid,text,text,text) to authenticated;
