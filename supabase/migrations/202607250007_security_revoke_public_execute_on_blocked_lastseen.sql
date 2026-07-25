-- Security: is_blocked and touch_last_seen must stay in the public schema
-- (is_blocked is called by the client's isBlockedWith since RLS hides
-- reverse-direction blocks; touch_last_seen is the presence heartbeat), but
-- neither should be callable by anon. EXECUTE was granted to PUBLIC, which anon
-- inherits, so a REVOKE ... FROM anon is a no-op -- we must revoke from PUBLIC.
-- `authenticated` holds its own explicit grant and keeps access.
REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_last_seen()      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_last_seen()      TO authenticated;
