-- Security: RLS-helper predicates were SECURITY DEFINER functions in the public
-- schema, so PostgREST exposed them as /rest/v1/rpc/* callable by anon (a way to
-- probe membership/staff status). They're only used inside RLS policies and one
-- helper function -- never as a client RPC -- so we relocate them to a private
-- schema that PostgREST does not expose. They still work in RLS (roles keep
-- EXECUTE + schema USAGE); they're just no longer part of the public API.
--
-- is_blocked stays public (the client's isBlockedWith needs it, since RLS hides
-- reverse-direction blocks); its anon access is closed in the next migration.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon;

-- 1) Recreate the two pure helpers in `private` (identical bodies).
CREATE OR REPLACE FUNCTION private.is_chat_member(p_chat_id uuid, p_user_id uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER
  SET search_path TO 'public' SET row_security TO 'off'
AS $fn$
  select exists (
    select 1 from public.chat_members cm
    where cm.chat_id = p_chat_id and cm.user_id = p_user_id
  );
$fn$;

CREATE OR REPLACE FUNCTION private.is_store_staff_for_chat(p_chat_id uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
  select exists (
    select 1
    from public.profiles p
    left join public.chats c on c.id = p_chat_id
    where p.id = auth.uid()
      and (
        p.role = 'superadmin'
        or (p.role in ('admin','agent') and p.store_id is not null and p.store_id = c.store_id)
      )
  );
$fn$;

GRANT EXECUTE ON FUNCTION private.is_chat_member(uuid, uuid)      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_store_staff_for_chat(uuid)   TO authenticated, anon;

-- 2) Repoint every policy that references the two helpers at the private schema.
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '\y(is_chat_member|is_store_staff_for_chat)\y'
  LOOP
    new_qual  := r.qual;
    new_check := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '\yis_chat_member\s*\(',        'private.is_chat_member(',      'g');
      new_qual := regexp_replace(new_qual, '\yis_store_staff_for_chat\s*\(','private.is_store_staff_for_chat(','g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '\yis_chat_member\s*\(',        'private.is_chat_member(',      'g');
      new_check := regexp_replace(new_check, '\yis_store_staff_for_chat\s*\(','private.is_store_staff_for_chat(','g');
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_qual  IS NOT NULL THEN stmt := stmt || format(' USING (%s)', new_qual); END IF;
    IF new_check IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', new_check); END IF;
    EXECUTE stmt;
    RAISE NOTICE 'repointed policy % on %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- 3) The one function that called public.is_chat_member now calls the private one.
CREATE OR REPLACE FUNCTION public.set_disappearing_messages(p_chat_id uuid, p_seconds integer)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
begin
  if not exists (
    select 1 from public.chats c
    where c.id = p_chat_id
      and (
        c.kind = 'direct' and private.is_chat_member(p_chat_id, auth.uid())
        or c.kind = 'group' and c.created_by = auth.uid()
      )
  ) then
    raise exception 'Not allowed to change this setting for this chat';
  end if;
  update public.chats set disappearing_seconds = nullif(p_seconds, 0) where id = p_chat_id;
end;
$fn$;

-- 4) Remove the public (API-exposed) copies now that nothing references them.
DROP FUNCTION public.is_chat_member(uuid, uuid);
DROP FUNCTION public.is_store_staff_for_chat(uuid);
