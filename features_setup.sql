-- =========================================================
-- AK ELECTRONICS PRO — NEW FEATURES SETUP
-- Run this AFTER supabase_setup.sql and admin_setup.sql,
-- in the same SQL Editor.
-- Adds: Wishlist, Coupon codes (+ discount columns on orders)
-- =========================================================

-- ---------------------------------------------------------
-- WISHLIST
-- ---------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  unique(user_id, product_id)
);

alter table public.wishlists enable row level security;

create policy "Users can view own wishlist"
  on public.wishlists for select
  using (auth.uid() = user_id);

create policy "Users can add to own wishlist"
  on public.wishlists for insert
  with check (auth.uid() = user_id);

create policy "Users can remove from own wishlist"
  on public.wishlists for delete
  using (auth.uid() = user_id);


-- ---------------------------------------------------------
-- COUPON CODES
-- ---------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  code text unique not null,
  discount_percent numeric not null default 0 check (discount_percent > 0 and discount_percent <= 100),
  active boolean default true,
  expires_at timestamptz
);

alter table public.coupons enable row level security;

-- Anyone can check a coupon code at checkout (read-only, only active ones)
create policy "Public can view active coupons"
  on public.coupons for select
  using (active = true);

-- Only the admin can create/edit/delete coupons
create policy "Admin can insert coupons"
  on public.coupons for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update coupons"
  on public.coupons for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete coupons"
  on public.coupons for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');


-- ---------------------------------------------------------
-- ORDERS — add coupon/discount tracking columns
-- ---------------------------------------------------------
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric default 0;


-- ---------------------------------------------------------
-- SAMPLE COUPON (safe to delete/edit from Admin Panel later)
-- ---------------------------------------------------------
insert into public.coupons (code, discount_percent, active) values
('WELCOME10', 10, true);

-- =========================================================
-- DONE.
-- =========================================================
