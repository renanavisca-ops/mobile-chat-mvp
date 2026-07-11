-- Replace the wide-open (USING true) chats/messages policies with membership-
-- based RLS, while keeping the store/agent support console working.

-- Helper: is the current user store staff (admin/superadmin/agent) for this chat?
create or replace function public.is_store_staff_for_chat(p_chat_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.chats c on c.id = p_chat_id
    where p.id = auth.uid()
      and (
        p.role = 'superadmin'
        or (p.role in ('admin','agent') and p.store_id is not null and p.store_id = c.store_id)
      )
  );
$$;
revoke execute on function public.is_store_staff_for_chat(uuid) from anon;
grant execute on function public.is_store_staff_for_chat(uuid) to authenticated;

-- ---------- CHATS ----------
drop policy if exists "chats_all" on public.chats;
drop policy if exists "superadmin_chats_all" on public.chats;
drop policy if exists "admin_chats_store_select" on public.chats;
drop policy if exists "agent_chats_store_select" on public.chats;

create policy "chats_select_member_or_staff" on public.chats
  for select to authenticated
  using ( public.is_chat_member(id, auth.uid()) or public.is_store_staff_for_chat(id) );

create policy "chats_insert_own" on public.chats
  for insert to authenticated
  with check ( created_by = auth.uid() );

create policy "chats_update_member_or_staff" on public.chats
  for update to authenticated
  using ( public.is_chat_member(id, auth.uid()) or public.is_store_staff_for_chat(id) );

-- ---------- MESSAGES ----------
drop policy if exists "messages_all" on public.messages;
drop policy if exists "messages_store_read" on public.messages;
drop policy if exists "messages_member_read" on public.messages;
drop policy if exists "messages_member_insert" on public.messages;

create policy "messages_select_member_or_staff" on public.messages
  for select to authenticated
  using ( public.is_chat_member(chat_id, auth.uid()) or public.is_store_staff_for_chat(chat_id) );

create policy "messages_insert_member_or_staff" on public.messages
  for insert to authenticated
  with check ( public.is_chat_member(chat_id, auth.uid()) or public.is_store_staff_for_chat(chat_id) );

create policy "messages_update_member_or_staff" on public.messages
  for update to authenticated
  using ( public.is_chat_member(chat_id, auth.uid()) or public.is_store_staff_for_chat(chat_id) );

-- ---------- CUSTOMER SUPPORT TABLES (accessed via service role in API) ----------
drop policy if exists "superadmin_customers_all" on public.customers;
create policy "customers_staff_read" on public.customers
  for select to authenticated
  using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin')) );

drop policy if exists "superadmin_sessions_all" on public.customer_chat_sessions;
create policy "sessions_staff_read" on public.customer_chat_sessions
  for select to authenticated
  using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin')) );
