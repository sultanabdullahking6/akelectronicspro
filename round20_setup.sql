-- =========================================================
-- AK ELECTRONICS PRO — ROUND 20: STARTER KITS + AD PLACEMENTS
-- Run this in Supabase SQL Editor.
--
-- Part A: Adds "starter_kit" as a new product type (own section)
-- Part B: Splits ads into 3 zones: splash video (on page load),
--         mid-page picture ads, and starter-kit picture ads
-- =========================================================

-- ---------------------------------------------------------
-- PART A: STARTER KITS (reuses the products table, new type)
-- ---------------------------------------------------------
alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check check (type in ('product', 'project', 'starter_kit'));

-- ---------------------------------------------------------
-- PART B: AD PLACEMENTS
-- ---------------------------------------------------------
alter table public.ads add column if not exists placement text default 'mid' check (placement in ('splash', 'mid', 'starterkit'));

-- =========================================================
-- DONE.
-- =========================================================
