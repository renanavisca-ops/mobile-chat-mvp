-- Create customers table
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  country text not null,
  created_at timestamptz not null default now()
);

-- Create customer_chat_sessions table
create table if not exists public.customer_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  public_token text not null unique,
  created_at timestamptz not null default now()
);

-- Alter messages table
alter table public.messages 
  add column if not exists sender_type text check (sender_type in ('agent', 'customer', 'system')) default 'agent',
  add column if not exists sender_id uuid, -- Can be agent (auth.users.id) or customer (customers.id)
  add column if not exists delivery_status text check (delivery_status in ('sent', 'delivered', 'read', 'failed')) default 'sent';

-- Add indexes
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customer_chat_sessions_token on public.customer_chat_sessions(public_token);
create index if not exists idx_customer_chat_sessions_chat_id on public.customer_chat_sessions(chat_id);
create index if not exists idx_messages_sender_type on public.messages(sender_type);

-- RLS for public tables (accessible via token in backend, no direct public access)
alter table public.customers enable row level security;
alter table public.customer_chat_sessions enable row level security;

-- Policies (We will bypass RLS in edge functions/backend using service role or allow specifically if needed)
-- Since the public chat API uses service_role key or we can create basic policies
-- For now, allow superadmin full access
create policy "superadmin_customers_all" on public.customers
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

create policy "superadmin_sessions_all" on public.customer_chat_sessions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

-- Update public.messages policy to allow reading if there's no auth but it's matched via server
-- Actually, the backend API will use the service_role or handle auth correctly. We don't need anon policies if accessed through our API routes.
