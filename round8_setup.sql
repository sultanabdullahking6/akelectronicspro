-- =========================================================
-- AK ELECTRONICS PRO — ROUND 8: AGENT ORDERS SPLIT
-- Run this AFTER round7_setup.sql, in the same SQL Editor.
--
-- Lets each agent see + update ONLY the orders relevant to them:
--   - products_agent → orders that contain at least one product-type item
--   - projects_agent → orders that contain at least one project-type item
-- Within a mixed order, agents only see the line items matching their type
-- (the order_items policy below filters that automatically).
-- =========================================================

-- ---------------------------------------------------------
-- ORDER_ITEMS — agents can view only their type's line items
-- ---------------------------------------------------------
create policy "Products agent can view product order items"
  on public.order_items for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent'
    and exists (select 1 from public.products p where p.id = order_items.product_id and p.type = 'product')
  );

create policy "Projects agent can view project order items"
  on public.order_items for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent'
    and exists (select 1 from public.products p where p.id = order_items.product_id and p.type = 'project')
  );

-- ---------------------------------------------------------
-- ORDERS — agents can view/update orders containing their type
-- ---------------------------------------------------------
create policy "Products agent can view product orders"
  on public.orders for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent'
    and exists (
      select 1 from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = orders.id and p.type = 'product'
    )
  );

create policy "Products agent can update product orders"
  on public.orders for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent'
    and exists (
      select 1 from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = orders.id and p.type = 'product'
    )
  );

create policy "Projects agent can view project orders"
  on public.orders for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent'
    and exists (
      select 1 from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = orders.id and p.type = 'project'
    )
  );

create policy "Projects agent can update project orders"
  on public.orders for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent'
    and exists (
      select 1 from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = orders.id and p.type = 'project'
    )
  );

-- =========================================================
-- DONE.
-- =========================================================
