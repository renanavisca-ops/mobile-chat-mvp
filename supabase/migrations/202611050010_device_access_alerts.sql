-- §1 · Alertas de acceso (inicio de sesión nuevo). Cada dispositivo registrado
-- es una sesión; un dispositivo nuevo queda `acknowledged=false` y las OTRAS
-- sesiones del usuario muestran un aviso hasta que se reconoce. Los dispositivos
-- existentes se marcan como reconocidos para no avisar retroactivamente.
alter table public.devices add column if not exists acknowledged boolean not null default false;
update public.devices set acknowledged = true where acknowledged = false;
