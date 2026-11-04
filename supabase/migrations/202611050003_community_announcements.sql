-- §5 · Anuncios por comunidad. El creador de la comunidad publica un anuncio
-- que se reparte (fan-out) como un mensaje normal a cada grupo vinculado, de
-- modo que llega a todos los miembros de la comunidad. Reutiliza el formato de
-- mensaje de la app (envelope {"v":1,"text":...} en ciphertext + content).

create or replace function public.post_community_announcement(p_community uuid, p_text text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_count int := 0;
  v_text text := trim(p_text);
  g record;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if v_text = '' then raise exception 'Empty announcement'; end if;
  -- Only the community owner may broadcast.
  if not exists (select 1 from public.communities where id = p_community and created_by = v_me) then
    raise exception 'not allowed';
  end if;
  for g in select chat_id from public.community_groups where community_id = p_community loop
    insert into public.messages (chat_id, message_type, ciphertext, content, sender_id)
    values (
      g.chat_id,
      'whisper',
      json_build_object('v', 1, 'text', v_text)::text,
      v_text,
      v_me
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

revoke all on function public.post_community_announcement(uuid, text) from anon;
grant execute on function public.post_community_announcement(uuid, text) to authenticated;
