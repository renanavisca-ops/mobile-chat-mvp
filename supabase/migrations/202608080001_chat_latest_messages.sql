-- Latest message per chat (exactly one row each), so the chat list never hides
-- a conversation just because its last message fell outside a global row cap.
-- SECURITY INVOKER so the caller's RLS on `messages` still applies.
create or replace function public.chat_latest_messages(p_chat_ids uuid[])
returns table (chat_id uuid, id uuid, content text, ciphertext text, created_at timestamptz, sender_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.chat_id) m.chat_id, m.id, m.content, m.ciphertext, m.created_at, m.sender_id
  from public.messages m
  where m.chat_id = any(p_chat_ids)
  order by m.chat_id, m.created_at desc
$$;

grant execute on function public.chat_latest_messages(uuid[]) to authenticated;
