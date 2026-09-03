-- =========================================================
-- AK ELECTRONICS PRO — ROUND 16: 5 NEW FEATURES
-- Run this in Supabase SQL Editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1. AGENT ACTIVITY LOG
-- ---------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  actor_email text,
  actor_role text,
  action text not null
);

alter table public.activity_log enable row level security;

create policy "Admin can view activity log"
  on public.activity_log for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- Any logged-in admin/agent can write a log entry
create policy "Admin/agents can insert activity log"
  on public.activity_log for insert
  with check (
    auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com'
    or (auth.jwt() -> 'user_metadata' ->> 'role') in ('products_agent', 'projects_agent')
  );

-- ---------------------------------------------------------
-- 2. BUNDLE DEALS
-- ---------------------------------------------------------
create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  description text,
  product_ids uuid[] not null default '{}',
  bundle_price numeric not null default 0,
  active boolean default true
);

alter table public.bundles enable row level security;

create policy "Public can view active bundles"
  on public.bundles for select
  using (active = true);

create policy "Admin can manage bundles - select"
  on public.bundles for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can manage bundles - insert"
  on public.bundles for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can manage bundles - update"
  on public.bundles for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can manage bundles - delete"
  on public.bundles for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- ---------------------------------------------------------
-- 3. PUBLIC "ORDERS TODAY" COUNT (safe — no order details exposed)
-- ---------------------------------------------------------
create or replace function public.get_todays_order_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from orders where created_at >= current_date;
$$;

-- ---------------------------------------------------------
-- 4. RECENT SALES COUNT PER PRODUCT (for "X sold this week" badge)
-- ---------------------------------------------------------
create or replace function public.get_recent_sales(product_id_param uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(oi.quantity), 0)::integer
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id = product_id_param and o.created_at >= now() - interval '7 days';
$$;

-- ---------------------------------------------------------
-- 5. ADMIN CAN DELETE ORDERS (paid/cancelled ones, from Admin Panel)
-- ---------------------------------------------------------
create policy "Admin can delete orders"
  on public.orders for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
