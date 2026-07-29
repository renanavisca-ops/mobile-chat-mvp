-- Allow encrypted chat media uploads.
--
-- Encrypted attachments (toky-media-v1) are uploaded to the private `chat-media`
-- bucket as opaque ciphertext with the MIME type `application/octet-stream`.
-- The bucket's allowlist only permitted concrete image/video/audio/document
-- types, so every attempt to send a photo/video/file in an encrypted (or
-- encryption-required) chat failed with "mime type application/octet-stream is
-- not supported". Add octet-stream to the allowlist so ciphertext blobs upload.
--
-- The bucket stays private and RLS-scoped to chat members, so this does not
-- widen who can read media — it only lets the encrypted byte stream through.

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m)
  from unnest(allowed_mime_types || array['application/octet-stream']) as m
)
where id = 'chat-media'
  and not ('application/octet-stream' = any(allowed_mime_types));
