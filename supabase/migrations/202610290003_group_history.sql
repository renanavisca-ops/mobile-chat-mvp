-- Group history: system messages for adds, removes, leaves, joins, role
-- changes and group creation. Rendered as centered system lines in the chat.

create or replace function public.log_group_membership() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_chat uuid;
  v_kind text;
  v_created timestamptz;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_target_name text;
  v_text text;
begin
  if TG_OP = 'DELETE' then v_chat := OLD.chat_id; else v_chat := NEW.chat_id; end if;
  select kind, created_at into v_kind, v_created from public.chats where id = v_chat;
  if v_kind is distinct from 'group' then return null; end if;

  if TG_OP = 'INSERT' then
    -- Skip the initial roster inserted while the group is being created.
    if v_created > now() - interval '5 seconds' then return null; end if;
    v_target_name := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = NEW.user_id);
    if NEW.user_id = v_actor then
      v_text := v_target_name || ' se unió con el enlace de invitación';
    else
      v_actor_name := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = v_actor);
      v_text := v_actor_name || ' agregó a ' || v_target_name;
    end if;
  elsif TG_OP = 'DELETE' then
    v_target_name := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = OLD.user_id);
    if OLD.user_id = v_actor then
      v_text := v_target_name || ' salió del grupo';
    else
      v_actor_name := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = v_actor);
      v_text := v_actor_name || ' eliminó a ' || v_target_name;
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.role is not distinct from OLD.role then return null; end if;
    v_target_name := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = NEW.user_id);
    v_actor_name := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = v_actor);
    if NEW.role = 'admin' then
      v_text := v_actor_name || ' nombró administrador a ' || v_target_name;
    else
      v_text := v_actor_name || ' quitó como administrador a ' || v_target_name;
    end if;
  end if;

  if v_text is not null then
    insert into public.messages (chat_id, sender_id, sender_type, message_type, delivery_status, read, nonce, content, ciphertext)
    values (v_chat, v_actor, 'system', 'system', 'read', true, gen_random_uuid()::text, v_text,
            json_build_object('v', 1, 'text', v_text)::text);
  end if;
  return null;
end; $$;

create or replace trigger trg_log_group_membership
  after insert or delete or update of role on public.chat_members
  for each row execute function public.log_group_membership();

-- "X creó el grupo" on creation (skipped for the self-chat / Notas personales).
create or replace function public.create_group_chat(title text, member_ids uuid[])
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  new_chat uuid;
  all_members uuid[];
  v_text text;
begin
  if me is null then raise exception 'Not authenticated'; end if;
  if title is null or length(trim(title)) = 0 then raise exception 'title is required'; end if;
  if member_ids is null or array_length(member_ids, 1) is null then raise exception 'member_ids is required'; end if;

  all_members := array(select distinct unnest(member_ids || array[me]));

  insert into public.chats(kind, created_by, title)
  values ('group', me, trim(title))
  returning id into new_chat;

  insert into public.chat_members(chat_id, user_id)
  select new_chat, m from unnest(all_members) as m;

  if array_length(all_members, 1) > 1 then
    v_text := (select coalesce(display_name, username, 'Alguien') from public.profiles where id = me) || ' creó el grupo';
    insert into public.messages (chat_id, sender_id, sender_type, message_type, delivery_status, read, nonce, content, ciphertext)
    values (new_chat, me, 'system', 'system', 'read', true, gen_random_uuid()::text, v_text,
            json_build_object('v', 1, 'text', v_text)::text);
  end if;

  return new_chat;
end; $$;
