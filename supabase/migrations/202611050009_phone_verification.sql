-- §1 · Verificación de teléfono como ATRIBUTO de la cuenta existente (no una
-- identidad de auth separada; el login por correo no cambia y no se duplican
-- cuentas). El SMS es SIMULADO por defecto (sin proveedor, sin costo); el
-- proveedor real queda pendiente (ver docs/PHONE.md).
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists phone_verified boolean not null default false;
-- Un teléfono pertenece a una sola cuenta.
create unique index if not exists profiles_phone_unique on public.profiles (phone) where phone is not null;

-- OTP pendiente por usuario. Solo el service-role (servidor) la toca: RLS
-- habilitado sin políticas = inaccesible a clientes.
create table if not exists public.phone_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.phone_verifications enable row level security;
