-- Per-chat unread counts for the current user. Groups use MY per-member read
-- (message_reads) rather than the shared messages.read flag, which in a group
-- only flips once EVERYONE has read — using it for the list kept a group I had
-- already read marked unread (and pinned to the top). 1:1 chats keep the flag.
create or replace function public.my_unread_counts(p_chat_ids uuid[])
returns table(chat_id uuid, cnt int)
language sql security definer set search_path = public as $$
  select m.chat_id, count(*)::int as cnt
  from public.messages m
  join public.chats c on c.id = m.chat_id
  where m.chat_id = any(p_chat_ids)
    and private.is_chat_member(m.chat_id, auth.uid())
    and m.sender_id is distinct from auth.uid()
    and coalesce(m.sender_type, 'user') <> 'system'
    and (
      (c.kind <> 'group' and m.read = false)
      or
      (c.kind = 'group' and not exists (
        select 1 from public.message_reads r
        where r.message_id = m.id and r.user_id = auth.uid()
      ))
    )
  group by m.chat_id;
$$;

grant execute on function public.my_unread_counts(uuid[]) to authenticated;
