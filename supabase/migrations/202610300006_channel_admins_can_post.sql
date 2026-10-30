-- Allow channel ADMINS (chat_members.role='admin'), not just the creator, to
-- post to a channel. Every other clause of the existing insert policy is kept
-- verbatim; only the channel branch gains "OR is_chat_admin".
alter policy messages_insert_member_or_staff on public.messages
with check (
  (private.is_chat_member(chat_id, (select auth.uid())) or private.is_store_staff_for_chat(chat_id))
  and (not exists (
    select 1 from public.chat_members cm
    where cm.chat_id = messages.chat_id and cm.user_id <> (select auth.uid())
      and is_blocked((select auth.uid()), cm.user_id)
  ))
  and (
    (not exists (select 1 from public.chats c where c.id = messages.chat_id and c.kind = 'channel'))
    or (exists (
      select 1 from public.chats c
      where c.id = messages.chat_id and c.kind = 'channel'
        and (c.created_by = (select auth.uid()) or private.is_chat_admin(messages.chat_id, (select auth.uid())))
    ))
  )
  and (
    (message_type = 'system')
    or (not exists (select 1 from public.chats c where c.id = messages.chat_id and c.kind = 'group' and c.perm_send = 'admins'))
    or private.is_chat_admin(chat_id, (select auth.uid()))
  )
);
