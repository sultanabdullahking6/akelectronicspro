-- =========================================================
-- AK ELECTRONICS PRO — FIX: ORDER_ITEMS INFINITE RECURSION
-- Run this in Supabase SQL Editor. This replaces the 4 order
-- policies from round8_setup.sql with versions that use a
-- helper function, breaking the circular check that caused
-- "infinite recursion detected in policy for relation order_items".
-- =========================================================

-- Remove the policies that caused the recursion
drop policy if exists "Products agent can view product orders" on public.orders;
drop policy if exists "Products agent can update product orders" on public.orders;
drop policy if exists "Projects agent can view project orders" on public.orders;
drop policy if exists "Projects agent can update project orders" on public.orders;

-- Helper function: checks if an order contains an item of a given type.
-- SECURITY DEFINER makes this check bypass RLS internally, which is what
-- breaks the orders <-> order_items circular policy check.
create or replace function public.order_contains_type(order_id_param uuid, type_param text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = order_id_param and p.type = type_param
  );
$$;

-- Recreate the 4 policies using the helper function instead of a direct subquery
create policy "Products agent can view product orders"
  on public.orders for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent'
    and public.order_contains_type(orders.id, 'product')
  );

create policy "Products agent can update product orders"
  on public.orders for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent'
    and public.order_contains_type(orders.id, 'product')
  );

create policy "Projects agent can view project orders"
  on public.orders for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent'
    and public.order_contains_type(orders.id, 'project')
  );

create policy "Projects agent can update project orders"
  on public.orders for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent'
    and public.order_contains_type(orders.id, 'project')
  );

-- =========================================================
-- DONE.
-- =========================================================
