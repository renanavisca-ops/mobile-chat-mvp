# Allowlist de registro (fase de prueba)

Durante la fase de prueba, **solo los correos autorizados pueden crear una cuenta**.
Se aplica con un trigger `BEFORE INSERT` en `auth.users` (no se puede saltar desde
el cliente). **No afecta a los usuarios ya existentes**, solo a registros nuevos.
Migración: `supabase/migrations/202611060001_signup_allowlist.sql`.

## Agregar un tester/tienda nuevo (para que pueda registrarse)
```sql
insert into public.signup_allowlist (email, note)
values (lower('NUEVO@correo.com'), 'tester')
on conflict (email) do nothing;
```

## Quitar a alguien de la lista (no borra su cuenta si ya existe)
```sql
delete from public.signup_allowlist where email = lower('correo@quitar.com');
```

## Ver la lista
```sql
select email, note, added_at from public.signup_allowlist order by email;
```

## Abrir la app al público (quitar la restricción)
Cuando el producto esté listo para registro libre:
```sql
drop trigger if exists trg_enforce_signup_allowlist on auth.users;
-- opcional: drop function public.enforce_signup_allowlist();
--           drop table public.signup_allowlist;
```
Mantener el trigger = cerrado (solo lista). Quitarlo = abierto a cualquiera.

## Nota: verificación de correo
La restricción de la lista es independiente de la **verificación de correo**.
Para exigir correo real, activar en el panel de Supabase:
**Authentication → Providers → Email → "Confirm email" = ON**
(o Authentication → Settings → "Enable email confirmations"). Eso obliga a cada
registro nuevo a confirmar desde su bandeja antes de poder usar la cuenta.
