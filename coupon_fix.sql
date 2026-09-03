-- =========================================================
-- AK ELECTRONICS PRO — COUPON PERMISSIONS FIX
-- Run this in Supabase SQL Editor. Safe to run even if these
-- policies already exist (drops and recreates them cleanly).
-- =========================================================

drop policy if exists "Admin can insert coupons" on public.coupons;
drop policy if exists "Admin can update coupons" on public.coupons;
drop policy if exists "Admin can delete coupons" on public.coupons;

create policy "Admin can insert coupons"
  on public.coupons for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update coupons"
  on public.coupons for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete coupons"
  on public.coupons for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
