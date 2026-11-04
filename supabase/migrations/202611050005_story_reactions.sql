-- §7 · Reacciones a historias. Un espectador deja una reacción (emoji) a una
-- historia que puede ver; el autor ve las reacciones a sus propias historias.
create table if not exists public.story_reactions (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  emoji    text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_reactions enable row level security;

-- El autor de la historia ve todas sus reacciones; cada quien ve la suya.
drop policy if exists story_reactions_select on public.story_reactions;
create policy story_reactions_select on public.story_reactions for select using (
  user_id = (select auth.uid())
  or exists (select 1 from public.stories s where s.id = story_id and s.user_id = (select auth.uid()))
);

-- Solo puedes insertar/cambiar/borrar TU reacción, y solo a una historia que
-- puedas ver (el EXISTS respeta el RLS de stories para el rol que inserta).
drop policy if exists story_reactions_insert on public.story_reactions;
create policy story_reactions_insert on public.story_reactions for insert with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.stories s where s.id = story_id)
);
drop policy if exists story_reactions_update on public.story_reactions;
create policy story_reactions_update on public.story_reactions for update using (user_id = (select auth.uid()));
drop policy if exists story_reactions_delete on public.story_reactions;
create policy story_reactions_delete on public.story_reactions for delete using (user_id = (select auth.uid()));
