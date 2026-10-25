-- Stickers: a public bucket holding each user's sticker PNGs under
-- `stickers/<userId>/<uuid>.png`. Stickers are public (like GIFs/avatars): they
-- are sent as a plain URL and rendered without a bubble, so recipients load them
-- by URL without any key. The bucket IS the collection — no table needed.

insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', true)
on conflict (id) do update set public = true;

-- RLS on storage.objects for this bucket. Public reads happen via the public
-- URL (bucket is public) and bypass RLS, so we only need policies for the owner
-- to list / upload / delete their own folder.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='stickers_select_own') then
    create policy "stickers_select_own" on storage.objects for select to authenticated
      using (bucket_id = 'stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='stickers_insert_own') then
    create policy "stickers_insert_own" on storage.objects for insert to authenticated
      with check (bucket_id = 'stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='stickers_delete_own') then
    create policy "stickers_delete_own" on storage.objects for delete to authenticated
      using (bucket_id = 'stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
