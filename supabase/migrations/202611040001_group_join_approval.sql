-- Etapa 1/§5 · Aprobación de ingreso a grupos. Cuando una tienda... (grupo) tiene
-- require_approval activo, unirse por enlace crea una SOLICITUD pendiente que un
-- administrador aprueba o rechaza, en vez de ingresar directo.

alter table public.chats add column if not exists require_approval boolean not null default false;

create table if not exists public.group_join_requests (
  chat_id    uuid not null references public.chats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
alter table public.group_join_requests enable row level security;

-- El solicitante ve su propia solicitud; los administradores del grupo ven las de
-- su grupo. Las escrituras pasan por las funciones SECURITY DEFINER de abajo.
drop policy if exists group_join_requests_select on public.group_join_requests;
create policy group_join_requests_select on public.group_join_requests
  for select using (user_id = auth.uid() or private.is_chat_admin(chat_id, auth.uid()));

-- Unirse por código: 'joined' | 'pending' | 'already_member'.
create or replace function public.request_group_join(p_code text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_chat uuid; v_me uuid := auth.uid(); v_req boolean;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  select id, require_approval into v_chat, v_req
  from public.chats where invite_code = p_code and kind = 'group';
  if v_chat is null then raise exception 'Invalid or expired invite'; end if;
  if exists (select 1 from public.chat_members where chat_id = v_chat and user_id = v_me) then
    return 'already_member';
  end if;
  if v_req then
    insert into public.group_join_requests(chat_id, user_id) values (v_chat, v_me)
      on conflict do nothing;
    return 'pending';
  end if;
  insert into public.chat_members(chat_id, user_id, role) values (v_chat, v_me, 'member');
  return 'joined';
end; $$;

create or replace function public.approve_group_join(p_chat uuid, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not private.is_chat_admin(p_chat, auth.uid()) then raise exception 'not allowed'; end if;
  insert into public.chat_members(chat_id, user_id, role) values (p_chat, p_user, 'member')
    on conflict do nothing;
  delete from public.group_join_requests where chat_id = p_chat and user_id = p_user;
end; $$;

create or replace function public.reject_group_join(p_chat uuid, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not private.is_chat_admin(p_chat, auth.uid()) then raise exception 'not allowed'; end if;
  delete from public.group_join_requests where chat_id = p_chat and user_id = p_user;
end; $$;

create or replace function public.set_group_require_approval(p_chat uuid, p_value boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not private.is_chat_admin(p_chat, auth.uid()) then raise exception 'not allowed'; end if;
  update public.chats set require_approval = p_value where id = p_chat and kind = 'group';
end; $$;

revoke all on function public.request_group_join(text) from anon;
revoke all on function public.approve_group_join(uuid, uuid) from anon;
revoke all on function public.reject_group_join(uuid, uuid) from anon;
revoke all on function public.set_group_require_approval(uuid, boolean) from anon;

grant execute on function public.request_group_join(text) to authenticated;
grant execute on function public.approve_group_join(uuid, uuid) to authenticated;
grant execute on function public.reject_group_join(uuid, uuid) to authenticated;
grant execute on function public.set_group_require_approval(uuid, boolean) to authenticated;
