-- §8 · Canales privados (por invitación). Un canal privado es kind='channel'
-- con is_public=false; el RLS existente (chats_select / messages_select) ya lo
-- deja solo a miembros, por lo que NO aparece en el directorio y su contenido
-- no es legible por terceros. El ingreso es por un código de invitación
-- (reutiliza chats.invite_code) vía funciones SECURITY DEFINER.

-- create_channel gana un 4º argumento opcional p_is_public. Cuando es false,
-- genera un invite_code único. Se conserva el overload de 3 args.
create or replace function public.create_channel(
  p_title text,
  p_description text default null,
  p_category text default null,
  p_is_public boolean default true
) returns uuid
language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_code text;
begin
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Channel name required';
  end if;
  if not p_is_public then
    loop
      v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      exit when not exists (select 1 from public.chats where invite_code = v_code);
    end loop;
  end if;
  insert into public.chats (kind, title, description, created_by, is_public, category, invite_code)
  values ('channel', p_title, p_description, auth.uid(), p_is_public,
          nullif(trim(coalesce(p_category, '')), ''), v_code)
  returning id into v_id;
  insert into public.chat_members (chat_id, user_id) values (v_id, auth.uid());
  return v_id;
end; $function$;

grant execute on function public.create_channel(text, text, text, boolean) to authenticated;

-- Preview a channel from its invite code (visible to non-members, hence definer).
create or replace function public.channel_invite_preview(p_code text)
returns table(id uuid, title text, description text, avatar_url text)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.description, c.avatar_url
  from public.chats c
  where c.invite_code = p_code and c.kind = 'channel';
$$;

-- Join a channel via its invite code (idempotent). Returns the chat id.
create or replace function public.join_channel_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_chat uuid; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  select id into v_chat from public.chats where invite_code = p_code and kind = 'channel';
  if v_chat is null then raise exception 'Invalid or expired invite'; end if;
  if exists (select 1 from public.chat_members where chat_id = v_chat and user_id = v_me) then
    return v_chat;
  end if;
  insert into public.chat_members(chat_id, user_id, role) values (v_chat, v_me, 'member');
  return v_chat;
end; $$;

revoke all on function public.channel_invite_preview(text) from anon;
revoke all on function public.join_channel_by_code(text) from anon;
grant execute on function public.channel_invite_preview(text) to authenticated;
grant execute on function public.join_channel_by_code(text) to authenticated;
