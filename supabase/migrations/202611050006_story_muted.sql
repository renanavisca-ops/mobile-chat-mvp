-- §7 · Silenciar historias de ciertas personas. Cada quien gestiona su propia
-- lista; las historias de autores silenciados no aparecen en su tira de rings.
create table if not exists public.story_muted (
  owner_id uuid not null references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, muted_id)
);
alter table public.story_muted enable row level security;

drop policy if exists story_muted_all on public.story_muted;
create policy story_muted_all on public.story_muted
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
