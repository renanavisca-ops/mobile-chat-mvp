-- Favorite chats (per member), for the "Favorites" filter and quick access.
alter table public.chat_members add column if not exists favorite boolean not null default false;

create or replace function public.set_chat_favorite(p_chat_id uuid, p_favorite boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.chat_members set favorite = coalesce(p_favorite, false)
  where chat_id = p_chat_id and user_id = auth.uid();
end; $$;

grant execute on function public.set_chat_favorite(uuid, boolean) to authenticated;
