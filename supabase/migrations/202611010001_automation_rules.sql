-- Etapa 7 · Automatizaciones básicas por palabra clave (por cuenta/tienda).
-- Reglas que, ante un mensaje ENTRANTE del cliente en un chat de soporte,
-- auto-responden y/o auto-etiquetan la conversación.
--
-- Cifrado: estas reglas se evalúan SOLO en el endpoint público de soporte, donde
-- el contenido ya es texto plano por diseño (el cliente no autenticado no tiene
-- clave E2EE). Nunca se aplican a chats 1:1/grupo con cifrado de extremo a
-- extremo: esos no pasan por este endpoint y el servidor no ve su contenido.

create table if not exists public.automation_rules (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores(id) on delete cascade,
  name            text not null,
  enabled         boolean not null default true,
  match_type      text not null default 'contains',   -- 'contains' | 'equals' | 'starts_with'
  keywords        text[] not null default '{}',        -- coincide con cualquiera
  case_sensitive  boolean not null default false,
  action_reply    text,                                -- respuesta automática (opcional)
  action_label_id uuid references public.store_labels(id) on delete set null, -- etiqueta (opcional)
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  constraint automation_rules_match_type_chk check (match_type in ('contains','equals','starts_with'))
);
create index if not exists automation_rules_store_idx on public.automation_rules (store_id, enabled, sort);

alter table public.automation_rules enable row level security;

-- Lectura: staff de la tienda. Escritura: solo administradores de la tienda.
drop policy if exists automation_rules_select_staff on public.automation_rules;
create policy automation_rules_select_staff on public.automation_rules
  for select using (private.is_store_staff(store_id));

drop policy if exists automation_rules_write_admin on public.automation_rules;
create policy automation_rules_write_admin on public.automation_rules
  for all
  using (private.is_store_admin(store_id))
  with check (private.is_store_admin(store_id));
