-- =========================================================
-- AK ELECTRONICS PRO — ROUND 9: DASHBOARD DATA
-- Run this AFTER round8_fix.sql, in the same SQL Editor.
-- Adds: customer_email (captured at checkout) and payment_status
-- on orders, needed for the new Admin/Agent Dashboard.
-- =========================================================

alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists payment_status text default 'unpaid';

-- =========================================================
-- DONE.
-- =========================================================
