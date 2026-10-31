-- Etapa 8 · Auditoría de acciones: bitácora de acciones sensibles del staff de
-- una tienda (cambios de rol, asignación/estado de conversaciones). La escriben
-- funciones SECURITY DEFINER y el rol de servicio; la leen los admins de la tienda.

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  store_id   uuid references public.stores(id) on delete cascade,
  actor_id   uuid,               -- quién la hizo
  action     text not null,      -- 'role_change' | 'chat_assigned' | 'chat_status'
  target_id  uuid,               -- entidad afectada (usuario / chat)
  detail     jsonb,              -- contexto breve, no sensible
  created_at timestamptz not null default now()
);
create index if not exists audit_log_store_idx on public.audit_log (store_id, created_at desc);

alter table public.audit_log enable row level security;

-- Lectura: solo administradores de la tienda. Sin policies de escritura: solo el
-- rol de servicio y las funciones SECURITY DEFINER insertan.
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select using (private.is_store_admin(store_id));

-- Registra un cambio de rol dentro del RPC existente (añade la inserción al log).
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
  old_role text;
begin
  if p_role not in ('agent', 'admin') then
    raise exception 'invalid role';
  end if;

  select role, store_id into caller_role, caller_store
  from public.profiles where id = auth.uid();

  select store_id, role into target_store, old_role
  from public.profiles where id = p_user;

  if caller_role = 'superadmin' then
    update public.profiles set role = p_role where id = p_user and role in ('agent', 'admin');
  elsif caller_role = 'admin' and caller_store is not null and caller_store = target_store then
    update public.profiles set role = p_role where id = p_user and role in ('agent', 'admin');
  else
    raise exception 'not allowed';
  end if;

  insert into public.audit_log (store_id, actor_id, action, target_id, detail)
  values (target_store, auth.uid(), 'role_change', p_user,
          jsonb_build_object('from', old_role, 'to', p_role));
end;
$$;
