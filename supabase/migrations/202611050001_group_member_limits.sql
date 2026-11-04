-- §5 · Límite configurable de miembros de grupo. Un admin fija un tope opcional
-- (chats.max_members); al intentar sumar a alguien por encima del tope, la
-- inserción en chat_members se rechaza. Reutiliza el trigger de política de
-- ingreso que ya corre en cada alta de miembro.

alter table public.chats add column if not exists max_members int;

-- Extiende el trigger existente: antes de aplicar la política de "quién puede
-- agregarme", comprueba el tope del grupo (aplica tanto a altas por un admin
-- como a autoincorporaciones por enlace). La primera alta (creador, recuento 0)
-- siempre pasa.
create or replace function public.enforce_group_add_policy() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text;
  v_policy text;
  v_max int;
  v_count int;
begin
  select kind, max_members into v_kind, v_max from public.chats where id = NEW.chat_id;

  -- Tope de miembros (solo grupos). Se evalúa antes de cualquier retorno para
  -- cubrir también las autoincorporaciones por enlace/aprobación.
  if v_kind = 'group' and v_max is not null then
    select count(*) into v_count from public.chat_members where chat_id = NEW.chat_id;
    if v_count >= v_max then
      raise exception 'Group member limit reached';
    end if;
  end if;

  -- Self-joins (channels, creator adding self, accepting an invite) always pass.
  if NEW.user_id = auth.uid() then return NEW; end if;
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

-- Admin-only setter (null clears the limit). Enforces that the new limit is not
-- below the current member count, so an admin can't set an impossible cap.
create or replace function public.set_group_max_members(p_chat uuid, p_max int)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_count int;
begin
  if not private.is_chat_admin(p_chat, auth.uid()) then raise exception 'not allowed'; end if;
  if p_max is not null then
    if p_max < 2 then raise exception 'limit too low'; end if;
    select count(*) into v_count from public.chat_members where chat_id = p_chat;
    if p_max < v_count then raise exception 'limit below current member count'; end if;
  end if;
  update public.chats set max_members = p_max where id = p_chat and kind = 'group';
end; $$;

revoke all on function public.set_group_max_members(uuid, int) from anon;
grant execute on function public.set_group_max_members(uuid, int) to authenticated;
