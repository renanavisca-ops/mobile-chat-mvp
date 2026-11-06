-- §Seguridad (fase de prueba) · Allowlist de registro.
-- Durante la fase de prueba, SOLO los correos autorizados pueden crear una cuenta.
-- Se aplica en la base con un trigger BEFORE INSERT en auth.users (a prueba de
-- bypass desde el cliente). NO afecta a los usuarios ya existentes (solo nuevos
-- registros). Para ABRIR la app al público:  drop trigger trg_enforce_signup_allowlist on auth.users;
-- (y, si se desea, drop de la tabla/función). Mantener el trigger = cerrado.

create table if not exists public.signup_allowlist (
  email text primary key,
  note text,
  added_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
-- Sin políticas: la lista no es legible por clientes anon/authenticated; solo la
-- función SECURITY DEFINER (dueña de la tabla) la consulta.

create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if NEW.email is not null and not exists (
    select 1 from public.signup_allowlist a
    where a.email = lower(trim(NEW.email))
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Este correo no está autorizado para registrarse durante la fase de prueba.';
  end if;
  return NEW;
end;
$fn$;

drop trigger if exists trg_enforce_signup_allowlist on auth.users;
create trigger trg_enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

-- Semilla: usuarios reales ya existentes (excluye cuentas de prueba de Google) ...
insert into public.signup_allowlist (email, note)
select distinct lower(trim(email)), 'usuario existente'
from auth.users
where lower(trim(email)) not in (
  'testuser@gmail.com','testuser12345@gmail.com','tokyuser999@gmail.com','tokytestuser99@gmail.com'
)
on conflict (email) do nothing;

-- ... más la lista oficial de testers de Play.
insert into public.signup_allowlist (email, note) values
 ('t6tuamigo@gmail.com','play tester'),
 ('curiosidades2526@gmail.com','play tester'),
 ('erwinamperez37@gmail.com','play tester'),
 ('importadoramixco3@gmail.com','play tester'),
 ('itatienda012023@gmail.com','play tester'),
 ('jennymal343@gmail.com','play tester'),
 ('pacatienda.amatitlan@gmail.com','play tester'),
 ('pacatiendados@gmail.com','play tester'),
 ('pacatiendapacificamigo@gmail.com','play tester'),
 ('pacatuamigo15@gmail.com','play tester'),
 ('pacatuamigo4@gmail.com','play tester'),
 ('pacatuamigo776@gmail.com','play tester'),
 ('pacatuamigomazatenango@gmail.com','play tester'),
 ('ptuamigo4@gmail.com','play tester'),
 ('renanavisca@gmail.com','play tester'),
 ('rrhh15tuamigo@gmail.com','play tester'),
 ('tomikacaesar@gmail.com','play tester'),
 ('tuamigocentranorte@gmail.com','play tester'),
 ('tuamigomonserrat@gmail.com','play tester')
on conflict (email) do nothing;
