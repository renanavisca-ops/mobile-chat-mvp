-- Etapa 7 · Campañas (BASE INTERNA, envíos DESACTIVADOS).
-- Modelo para: consentimiento y baja por tienda/cliente, estado de campaña y
-- límites. No hay envío masivo ni proveedores externos (SMS/WhatsApp/email).
-- Lo que falta para enviar de forma fiable está en docs/CAMPAIGNS.md.

-- Consentimiento / baja por (tienda, cliente). El consentimiento es por tienda:
-- un cliente puede aceptar comunicaciones de una tienda y no de otra.
create table if not exists public.store_customer_consent (
  store_id    uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  consent     boolean not null default false,  -- opt-in explícito
  source      text,                            -- de dónde vino el consentimiento
  opted_out_at timestamptz,                    -- baja (tiene prioridad sobre consent)
  updated_at  timestamptz not null default now(),
  primary key (store_id, customer_id)
);
alter table public.store_customer_consent enable row level security;

drop policy if exists store_customer_consent_select_staff on public.store_customer_consent;
create policy store_customer_consent_select_staff on public.store_customer_consent
  for select using (private.is_store_staff(store_id));

drop policy if exists store_customer_consent_write_admin on public.store_customer_consent;
create policy store_customer_consent_write_admin on public.store_customer_consent
  for all using (private.is_store_admin(store_id)) with check (private.is_store_admin(store_id));

-- Campañas: estado y límites. Sin lógica de envío.
create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  name         text not null,
  body         text not null,
  status       text not null default 'draft',  -- draft|scheduled|sending|sent|cancelled
  daily_limit  int not null default 0,          -- 0 = sin límite definido
  scheduled_at timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  constraint campaigns_status_chk check (status in ('draft','scheduled','sending','sent','cancelled'))
);
create index if not exists campaigns_store_idx on public.campaigns (store_id, created_at desc);
alter table public.campaigns enable row level security;

drop policy if exists campaigns_select_staff on public.campaigns;
create policy campaigns_select_staff on public.campaigns
  for select using (private.is_store_staff(store_id));

drop policy if exists campaigns_write_admin on public.campaigns;
create policy campaigns_write_admin on public.campaigns
  for all using (private.is_store_admin(store_id)) with check (private.is_store_admin(store_id));

-- Audiencia elegible (destinatarios autorizados): clientes con consentimiento y
-- sin baja. Solo la cuenta — no expone datos de clientes. Admin de la tienda.
create or replace function public.campaign_audience_count(p_store_id uuid)
returns int
language sql
security definer
set search_path to 'public'
as $$
  select case
    when not private.is_store_admin(p_store_id) then 0
    else (
      select count(*)::int from public.store_customer_consent cc
      where cc.store_id = p_store_id and cc.consent = true and cc.opted_out_at is null
    )
  end;
$$;
revoke all on function public.campaign_audience_count(uuid) from anon;
