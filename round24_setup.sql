-- =========================================================
-- AK ELECTRONICS PRO — ROUND 24: GUEST CHECKOUT
-- Run this in Supabase SQL Editor.
-- Lets customers order WITHOUT creating an account. Guest
-- orders have user_id = null and are tracked only by the
-- order confirmation shown to them (and your Admin Panel).
-- =========================================================

alter table public.orders alter column user_id drop not null;

create policy "Guests can create orders"
  on public.orders for insert
  with check (user_id is null);

create policy "Guests can create order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id is null
    )
  );

-- =========================================================
-- DONE.
-- =========================================================
