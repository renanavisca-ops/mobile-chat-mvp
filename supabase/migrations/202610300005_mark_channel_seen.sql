-- Record that a follower has seen a channel's posts, into message_views (reused
-- as a generic "seen" signal) so the channel owner can see per-post reach.
-- Mirrors mark_group_read but writes to message_views; meant for channels.
create or replace function public.mark_channel_seen(p_chat_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_chat_member(p_chat_id, auth.uid()) then
    raise exception 'not a member';
  end if;
  insert into public.message_views (message_id, chat_id, user_id)
  select m.id, m.chat_id, auth.uid()
  from public.messages m
  where m.chat_id = p_chat_id
    and m.sender_id is distinct from auth.uid()
    and coalesce(m.sender_type, 'user') <> 'system'
    and not exists (
      select 1 from public.message_views v where v.message_id = m.id and v.user_id = auth.uid()
    )
  on conflict do nothing;
end; $$;

grant execute on function public.mark_channel_seen(uuid) to authenticated;
