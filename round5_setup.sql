-- =========================================================
-- AK ELECTRONICS PRO — ROUND 5: LIVE LOCATION
-- Run this AFTER round4_setup.sql, in the same SQL Editor.
-- Adds: precise lat/lng columns on orders (captured from the
-- customer's "Use My Location" button at checkout)
-- =========================================================

alter table public.orders add column if not exists latitude numeric;
alter table public.orders add column if not exists longitude numeric;

-- =========================================================
-- DONE.
-- =========================================================
