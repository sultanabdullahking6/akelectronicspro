-- =========================================================
-- AK ELECTRONICS PRO — ROUND 12: CUSTOMER EXPERIENCE FEATURES
-- Run this AFTER round11_setup.sql, in the same SQL Editor.
-- Adds: Loyalty points (profiles), delivery city + charge (orders)
-- =========================================================

alter table public.profiles add column if not exists loyalty_points integer default 0;
alter table public.orders add column if not exists delivery_city text;
alter table public.orders add column if not exists delivery_charge numeric default 0;
alter table public.orders add column if not exists points_redeemed integer default 0;

-- Note: profiles already has an "Users can update own profile" policy from
-- supabase_setup.sql, which covers updating loyalty_points too — no new
-- policy needed here.

-- Default delivery charges per city — editable later from Admin Dashboard settings
insert into public.settings (key, value) values
  ('delivery_charge_lahore', '0'),
  ('delivery_charge_other', '250')
on conflict (key) do nothing;

-- =========================================================
-- DONE.
-- =========================================================
