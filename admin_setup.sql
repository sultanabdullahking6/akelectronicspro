-- =========================================================
-- AK ELECTRONICS — ADMIN ACCESS SETUP
-- Run this AFTER supabase_setup.sql, in the same SQL Editor.
-- This grants admin-only powers (add/edit/delete products,
-- view & update all orders) to ONE specific email address.
-- =========================================================

-- ---------------------------------------------------------
-- PRODUCTS — admin can add, edit, delete
-- ---------------------------------------------------------
create policy "Admin can insert products"
  on public.products for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update products"
  on public.products for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete products"
  on public.products for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');


-- ---------------------------------------------------------
-- ORDERS — admin can view every customer's orders and update status
-- ---------------------------------------------------------
create policy "Admin can view all orders"
  on public.orders for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update orders"
  on public.orders for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');


-- ---------------------------------------------------------
-- ORDER ITEMS — admin can view every order's items
-- ---------------------------------------------------------
create policy "Admin can view all order items"
  on public.order_items for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE. Your admin email (abdullahsultan6@gmail.com) can now
-- fully manage products/projects and see + update all orders,
-- while every other customer still only sees their own data.
-- =========================================================
