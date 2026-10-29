-- Group invite links (shareable link / QR) with revocation.
alter table public.chats add column if not exists invite_code text;
create unique index if not exists chats_invite_code_key on public.chats (invite_code) where invite_code is not null;

-- Create or rotate a group's invite code (admin only). Returns the new code.
create or replace function public.rotate_group_invite(p_chat_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not private.is_chat_admin(p_chat_id, auth.uid()) then raise exception 'Only admins can manage the invite link'; end if;
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    exit when not exists (select 1 from public.chats where invite_code = v_code);
  end loop;
  update public.chats set invite_code = v_code where id = p_chat_id and kind = 'group';
  return v_code;
end; $$;

-- Revoke the invite link (admin only) — old links stop working.
create or replace function public.revoke_group_invite(p_chat_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_chat_admin(p_chat_id, auth.uid()) then raise exception 'Only admins can manage the invite link'; end if;
  update public.chats set invite_code = null where id = p_chat_id;
end; $$;

-- Preview a group from an invite code (visible to non-members, hence definer).
create or replace function public.group_invite_preview(p_code text)
returns table(chat_id uuid, title text, avatar_url text, members int)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.avatar_url,
         (select count(*)::int from public.chat_members cm where cm.chat_id = c.id)
  from public.chats c
  where c.invite_code = p_code and c.kind = 'group';
$$;

-- Join a group via its invite code. Returns the chat id (idempotent).
create or replace function public.join_group_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_chat uuid; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  select id into v_chat from public.chats where invite_code = p_code and kind = 'group';
  if v_chat is null then raise exception 'Invalid or expired invite'; end if;
  if exists (select 1 from public.chat_members where chat_id = v_chat and user_id = v_me) then
    return v_chat;
  end if;
  insert into public.chat_members(chat_id, user_id, role) values (v_chat, v_me, 'member');
  return v_chat;
end; $$;

grant execute on function public.rotate_group_invite(uuid) to authenticated;
grant execute on function public.revoke_group_invite(uuid) to authenticated;
grant execute on function public.group_invite_preview(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
