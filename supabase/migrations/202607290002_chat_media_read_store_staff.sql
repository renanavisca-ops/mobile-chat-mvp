-- Mirror the messages read policy (is_chat_member OR is_store_staff_for_chat)
-- onto storage.objects for chat-media. Store staff / superadmin who can already
-- read a chat's TEXT (via private.is_store_staff_for_chat) previously could not
-- read its MEDIA, because the chat-media storage policies only covered
-- chat_members. That split showed the text of an image message but surfaced
-- "Object not found" for the image itself. This grants the matching read.
create policy "chat_media_read_store_staff_v1"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and name ~ '^chats/[0-9a-fA-F-]{36}/'
  and private.is_store_staff_for_chat((split_part(name, '/', 2))::uuid)
);
