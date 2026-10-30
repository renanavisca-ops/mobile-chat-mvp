-- Channel categories for the discovery directory. A `category` slug on the
-- chat row, set at creation; create_channel gains an optional p_category.
alter table public.chats add column if not exists category text;

create index if not exists chats_channel_category_idx
  on public.chats (category) where kind = 'channel';

-- New 3-arg overload (keeps the old 2-arg to avoid a DROP). The client always
-- passes p_category now, so PostgREST resolves to this one unambiguously.
create or replace function public.create_channel(p_title text, p_description text default null, p_category text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Channel name required';
  end if;
  insert into public.chats (kind, title, description, created_by, is_public, category)
  values ('channel', p_title, p_description, auth.uid(), true, nullif(trim(coalesce(p_category, '')), ''))
  returning id into v_id;
  insert into public.chat_members (chat_id, user_id) values (v_id, auth.uid());
  return v_id;
end; $function$;

grant execute on function public.create_channel(text, text, text) to authenticated;
