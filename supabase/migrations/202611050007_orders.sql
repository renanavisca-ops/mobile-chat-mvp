-- §12 · Pedidos desde el catálogo. El cliente arma un carrito en el chat de
-- soporte y envía un pedido; se guarda como orders + order_items (con snapshot
-- de título/precio) y se publica un resumen en el chat para el agente. El
-- personal de la tienda lee y cambia el estado del pedido.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending',  -- pending|confirmed|preparing|ready|completed|cancelled
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_store_idx on public.orders (store_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.store_products(id) on delete set null,
  title text not null,
  price text,
  qty int not null default 1 check (qty > 0),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Store staff read and manage their store's orders. Inserts are done by the
-- server (service role) from the public-chat endpoint, so there is no client
-- INSERT policy (service role bypasses RLS).
drop policy if exists orders_select_staff on public.orders;
create policy orders_select_staff on public.orders
  for select using (private.is_store_staff(store_id));
drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update using (private.is_store_staff(store_id)) with check (private.is_store_staff(store_id));

drop policy if exists order_items_select_staff on public.order_items;
create policy order_items_select_staff on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and private.is_store_staff(o.store_id))
  );
