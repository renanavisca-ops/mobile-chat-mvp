-- Fix account deletion failing with "Database error deleting user".
--
-- Deleting an auth user cascades their `devices` rows, but messages the user
-- sent are intentionally retained and still reference those devices via
-- messages.sender_device_id. That FK was created with the default ON DELETE
-- NO ACTION, so the cascade hit a still-referenced device row and Postgres
-- aborted the entire user delete (error 23503).
--
-- sender_device_id is nullable and only records which E2EE device sent the
-- message, so dropping the link when the device is deleted is correct: the
-- message survives (anonymized once the profile is gone) while the delete
-- succeeds.
ALTER TABLE public.messages
  DROP CONSTRAINT messages_sender_device_id_fkey,
  ADD CONSTRAINT messages_sender_device_id_fkey
    FOREIGN KEY (sender_device_id)
    REFERENCES public.devices (id)
    ON DELETE SET NULL;
