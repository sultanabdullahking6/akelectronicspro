-- =========================================================
-- AK ELECTRONICS PRO — ROUND 23: FIX MISSING ORDER COLUMNS
-- Run this in Supabase SQL Editor.
--
-- Fixes: "We couldn't find X column" error when placing ANY
-- order (discount or not). This happens if round17_setup.sql
-- (or an earlier round) didn't fully run. This file is 100%
-- safe to run — it only adds columns that are missing, it
-- never touches existing data.
-- =========================================================

alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists payment_status text default 'unpaid';
alter table public.orders add column if not exists latitude numeric;
alter table public.orders add column if not exists longitude numeric;
alter table public.orders add column if not exists delivery_city text;
alter table public.orders add column if not exists delivery_charge numeric default 0;
alter table public.orders add column if not exists points_redeemed integer default 0;
alter table public.orders add column if not exists referral_discount numeric default 0;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric default 0;

alter table public.profiles add column if not exists loyalty_points integer default 0;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id);
alter table public.profiles add column if not exists referral_rewarded boolean default false;

-- Confirm everything is now present:
select column_name from information_schema.columns where table_name = 'orders' order by column_name;

-- =========================================================
-- DONE.
-- =========================================================
