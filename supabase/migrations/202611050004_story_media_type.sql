-- §7 · Historias de video (y base para audio). Hasta ahora toda historia con
-- media era imagen; se añade media_type para distinguir image/video/audio.
-- Las filas existentes con media_path se marcan como 'image'.

alter table public.stories add column if not exists media_type text;

update public.stories set media_type = 'image'
  where media_type is null and media_path is not null;

-- Allow short video (and larger files) in the stories bucket, previously
-- restricted to images at 5MB. New cap 30MB.
update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
where id = 'stories';
