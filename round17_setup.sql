-- =========================================================
-- AK ELECTRONICS PRO — ROUND 17: REFERRAL PROGRAM
-- Run this in Supabase SQL Editor.
-- Customer shares their link -> friend signs up with it -> on the
-- friend's first order, friend gets 10% off AND the referrer gets
-- 200 reward points, automatically, once per referred friend.
-- =========================================================

alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id);
alter table public.profiles add column if not exists referral_rewarded boolean default false;
alter table public.orders add column if not exists referral_discount numeric default 0;

-- =========================================================
-- DONE.
-- =========================================================
