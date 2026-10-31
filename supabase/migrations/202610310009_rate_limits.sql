-- Etapa 8 · Rate limiting / anti-spam (slice): limitador por ventana fija,
-- usado por el endpoint público de soporte (envío de mensajes del cliente no
-- autenticado). Solo lo toca el rol de servicio del servidor.

create table if not exists public.rate_limits (
  bucket       text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- Sin policies: RLS habilitado = denegado para anon/authenticated. El rol de
-- servicio (usado por las rutas API del servidor) lo omite.
alter table public.rate_limits enable row level security;

-- Incrementa el contador del bucket dentro de la ventana y devuelve true si la
-- petición está permitida (<= límite). Reinicia la ventana cuando expira.
create or replace function public.rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cur_count int;
begin
  insert into public.rate_limits as r (bucket, count, window_start)
    values (p_bucket, 1, now())
  on conflict (bucket) do update
    set count = case
                  when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
                  else r.count + 1
                end,
        window_start = case
                  when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
                  else r.window_start
                end
  returning r.count into cur_count;
  return cur_count <= p_limit;
end;
$$;

-- Solo el servidor (rol de servicio) debe invocarlo.
revoke all on function public.rate_limit_hit(text, int, int) from anon, authenticated;
