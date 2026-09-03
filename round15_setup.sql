-- =========================================================
-- AK ELECTRONICS PRO — ROUND 15: INQUIRY NAME FIELD
-- Run this in Supabase SQL Editor.
-- Adds a "name" column to custom_inquiries so you know who's asking.
-- =========================================================

alter table public.custom_inquiries add column if not exists name text;

-- =========================================================
-- DONE.
-- =========================================================
