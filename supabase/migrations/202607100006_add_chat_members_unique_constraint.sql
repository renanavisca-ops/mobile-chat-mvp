-- Required by API upserts using onConflict: 'chat_id,user_id'.
create unique index if not exists chat_members_chat_user_unique_idx
  on public.chat_members (chat_id, user_id);
