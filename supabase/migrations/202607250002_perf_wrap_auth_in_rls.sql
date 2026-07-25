-- Performance: Supabase's `auth_rls_initplan` linter flags RLS policies that
-- call auth.uid()/auth.role()/auth.jwt() directly, because those are
-- re-evaluated once PER ROW. Wrapping each call in a scalar subselect
-- ((select auth.uid())) lets Postgres treat it as an initplan and evaluate it
-- once per statement, with identical semantics.
--
-- This rewrites every public-schema policy that still contains a bare call.
-- It is idempotent: policies already using the (select ...) form are skipped
-- by the guard in the WHERE clause. Atomic — a failure on any policy rolls the
-- whole thing back.
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
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.(uid|role|jwt)\(\)' AND qual !~ 'select auth\.(uid|role|jwt)\(\)')
        OR
        (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|role|jwt)\(\)' AND with_check !~ 'select auth\.(uid|role|jwt)\(\)')
      )
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, 'auth\.uid\(\)',  '(select auth.uid())',  'g');
      new_qual := regexp_replace(new_qual, 'auth\.role\(\)', '(select auth.role())', 'g');
      new_qual := regexp_replace(new_qual, 'auth\.jwt\(\)',  '(select auth.jwt())',  'g');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, 'auth\.uid\(\)',  '(select auth.uid())',  'g');
      new_check := regexp_replace(new_check, 'auth\.role\(\)', '(select auth.role())', 'g');
      new_check := regexp_replace(new_check, 'auth\.jwt\(\)',  '(select auth.jwt())',  'g');
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
    RAISE NOTICE 'rewrote policy % on %', r.policyname, r.tablename;
  END LOOP;
END $$;
