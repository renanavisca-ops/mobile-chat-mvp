-- §12 · Entregas de campaña. El worker (canal SIMULADO por ahora; el real
-- queda pendiente de proveedor) registra una fila por destinatario autorizado.
-- El envío está DESACTIVADO por defecto (gate por variables de entorno).
create table if not exists public.campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'queued',  -- queued|sent|failed|skipped
  channel text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists campaign_deliveries_campaign_idx on public.campaign_deliveries (campaign_id, created_at desc);
alter table public.campaign_deliveries enable row level security;

-- El personal de la tienda lee las entregas de sus campañas. Las inserciones
-- las hace el worker con service-role (bypassa RLS). Política creada en una
-- sentencia aparte (ver migración aplicada).
-- create policy campaign_deliveries_select_staff on public.campaign_deliveries
--   for select using (private.is_store_staff(store_id));
