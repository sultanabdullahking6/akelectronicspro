-- =========================================================
-- AK ELECTRONICS PRO — ROUND 14: RESTOCK NOTIFICATIONS
-- Run this in Supabase SQL Editor.
-- Lets customers leave their email on an out-of-stock product;
-- you see who's waiting in the Admin Panel and can reach out
-- once it's back in stock.
-- =========================================================

create table public.restock_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  product_id uuid references public.products(id) on delete cascade,
  product_name text,
  email text not null,
  notified boolean default false
);

alter table public.restock_notifications enable row level security;

create policy "Public can request restock notification"
  on public.restock_notifications for insert
  with check (true);

create policy "Admin can view restock notifications"
  on public.restock_notifications for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update restock notifications"
  on public.restock_notifications for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Products agent can view restock notifications"
  on public.restock_notifications for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can update restock notifications"
  on public.restock_notifications for update
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

-- =========================================================
-- DONE.
-- =========================================================
