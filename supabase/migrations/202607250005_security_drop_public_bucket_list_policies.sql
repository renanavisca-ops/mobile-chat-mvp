-- Security: the `avatars` and `group-avatars` public buckets each had a broad
-- SELECT policy on storage.objects (USING bucket_id = '<bucket>'), which let any
-- client LIST every file in the bucket via the storage API.
--
-- Public buckets serve object bytes directly through getPublicUrl without any
-- storage.objects SELECT policy, and the app only ever uploads to these buckets
-- and reads them by public URL. The one .list() call (account deletion) uses the
-- service role, which bypasses RLS. So these policies granted anonymous bucket
-- enumeration with no functional benefit. Dropping them.
DROP POLICY IF EXISTS avatars_read_all       ON storage.objects;
DROP POLICY IF EXISTS group_avatars_read_all ON storage.objects;
