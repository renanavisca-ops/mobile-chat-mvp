-- Etapa 7 · Multiagente: cambiar el rol de un miembro del staff de la tienda.
-- profiles solo permite auto-actualización, así que el cambio de rol de otra
-- persona pasa por esta función SECURITY DEFINER con validación del llamador.

create or replace function public.set_store_member_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  caller_role text;
  caller_store uuid;
  target_store uuid;
begin
  if p_role not in ('agent', 'admin') then
    raise exception 'invalid role';
  end if;

  select role, store_id into caller_role, caller_store
  from public.profiles where id = auth.uid();

  select store_id into target_store
  from public.profiles where id = p_user;

  if caller_role = 'superadmin' then
    update public.profiles set role = p_role
    where id = p_user and role in ('agent', 'admin');
  elsif caller_role = 'admin' and caller_store is not null and caller_store = target_store then
    -- Un admin solo mueve entre agent/admin dentro de su propia tienda; nunca
    -- toca a un superadmin ni se auto-degrada fuera de esos dos roles.
    update public.profiles set role = p_role
    where id = p_user and role in ('agent', 'admin');
  else
    raise exception 'not allowed';
  end if;
end;
$$;

revoke all on function public.set_store_member_role(uuid, text) from anon;
