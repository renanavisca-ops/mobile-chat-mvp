-- Performance: two tables each had two PERMISSIVE policies for the same action,
-- so both ran on every relevant query. Permissive policies are OR-ed anyway, so
-- merging each pair into one policy with the OR of their conditions is identical
-- in effect and evaluates once. Roles widened to `public` (a superset of
-- `authenticated`); the auth.uid()-based branches still fail for anon, so no
-- access changes. Atomic within this migration's transaction.

-- chat_members: INSERT (creator OR public-channel self-join)
DROP POLICY IF EXISTS chat_members_insert_creator      ON public.chat_members;
DROP POLICY IF EXISTS chat_members_join_public_channel ON public.chat_members;

CREATE POLICY chat_members_insert ON public.chat_members
  FOR INSERT TO public
  WITH CHECK (
    (EXISTS ( SELECT 1 FROM chats c
              WHERE c.id = chat_members.chat_id
                AND c.created_by = (SELECT auth.uid()) ))
    OR
    ( (user_id = (SELECT auth.uid()))
      AND EXISTS ( SELECT 1 FROM chats c
                   WHERE c.id = chat_members.chat_id
                     AND c.kind = 'channel'::text
                     AND c.is_public ) )
  );

-- chats: SELECT (member/staff OR public channel)
DROP POLICY IF EXISTS chats_select_member_or_staff ON public.chats;
DROP POLICY IF EXISTS chats_select_public_channel  ON public.chats;

CREATE POLICY chats_select ON public.chats
  FOR SELECT TO public
  USING (
    is_chat_member(id, (SELECT auth.uid()))
    OR is_store_staff_for_chat(id)
    OR (kind = 'channel'::text AND is_public)
  );
