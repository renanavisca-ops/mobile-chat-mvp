-- Etapa 7 · Estadísticas de soporte (entrega/lectura/atención) de una tienda.
-- RPC que agrega métricas y solo la puede llamar un admin/superadmin de la tienda.

create or replace function public.store_support_stats(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or (role = 'admin' and store_id = p_store_id))
  ) then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'chats_open',        (select count(*) from public.chats where store_id = p_store_id and status = 'open'),
    'chats_in_progress', (select count(*) from public.chats where store_id = p_store_id and status = 'in_progress'),
    'chats_closed',      (select count(*) from public.chats where store_id = p_store_id and status = 'closed'),
    'chats_total',       (select count(*) from public.chats where store_id = p_store_id),
    'customers',         (select count(distinct customer_id) from public.customer_chat_sessions s
                            join public.chats c on c.id = s.chat_id where c.store_id = p_store_id),
    'msgs_7d_total',     (select count(*) from public.messages m join public.chats c on c.id = m.chat_id
                            where c.store_id = p_store_id and m.created_at > now() - interval '7 days'),
    'msgs_7d_customer',  (select count(*) from public.messages m join public.chats c on c.id = m.chat_id
                            where c.store_id = p_store_id and m.sender_type = 'customer' and m.created_at > now() - interval '7 days'),
    'msgs_7d_staff',     (select count(*) from public.messages m join public.chats c on c.id = m.chat_id
                            where c.store_id = p_store_id and coalesce(m.sender_type,'') <> 'customer' and m.created_at > now() - interval '7 days'),
    'unread_customer',   (select count(*) from public.messages m join public.chats c on c.id = m.chat_id
                            where c.store_id = p_store_id and m.sender_type = 'customer' and m.read = false and c.status <> 'closed'),
    'by_agent',          (select coalesce(jsonb_agg(a), '[]'::jsonb) from (
                            select p.id as agent_id,
                                   coalesce(p.display_name, p.username, '—') as name,
                                   (select count(*) from public.chats c where c.store_id = p_store_id and c.assigned_to = p.id and c.status <> 'closed') as active,
                                   (select count(*) from public.chats c where c.store_id = p_store_id and c.assigned_to = p.id and c.status = 'closed') as closed
                            from public.profiles p
                            where p.store_id = p_store_id and p.role in ('agent','admin','superadmin')
                            order by name
                          ) a)
  ) into result;

  return result;
end;
$$;

revoke all on function public.store_support_stats(uuid) from anon;
