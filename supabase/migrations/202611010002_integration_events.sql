-- Etapa 7 · Integraciones (estructura preparada, SIN proveedor externo).
-- "Outbox" de eventos internos: el adaptador local de prueba graba aquí los
-- eventos de negocio (no sensibles). Un futuro adaptador (p. ej. webhook) leería
-- esta tabla y los entregaría; esa entrega NO está construida (ver docs/INTEGRATIONS.md).
--
-- Importante: los eventos NO contienen contenido de mensajes ni datos sensibles,
-- solo identificadores y metadatos (tipo de evento, ids, marcas de tiempo).

create table if not exists public.integration_events (
  id         bigint generated always as identity primary key,
  store_id   uuid references public.stores(id) on delete cascade,
  type       text not null,       -- p. ej. 'support.chat_created', 'support.message_received'
  data       jsonb not null default '{}'::jsonb,  -- solo ids/metadatos, nunca contenido
  delivered  boolean not null default false,       -- lo usaría un futuro entregador
  created_at timestamptz not null default now()
);
create index if not exists integration_events_store_idx on public.integration_events (store_id, created_at desc);
create index if not exists integration_events_undelivered_idx on public.integration_events (delivered, created_at) where delivered = false;

alter table public.integration_events enable row level security;

-- Lectura: solo administradores de la tienda (para inspeccionar). Sin policies de
-- escritura: solo el rol de servicio (rutas API del servidor) inserta.
drop policy if exists integration_events_select_admin on public.integration_events;
create policy integration_events_select_admin on public.integration_events
  for select using (private.is_store_admin(store_id));
