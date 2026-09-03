-- =========================================================
-- AK ELECTRONICS PRO — ROUND 11: SETTINGS (COMMISSION %)
-- Run this AFTER round10_setup.sql, in the same SQL Editor.
-- Lets you set your own commission percentage from the Admin
-- Dashboard instead of it being fixed at 5%.
-- =========================================================

create table public.settings (
  key text primary key,
  value text
);

alter table public.settings enable row level security;

-- Anyone can read settings (needed so the dashboard can show the current %)
create policy "Public can view settings"
  on public.settings for select
  using (true);

-- Only admin can change settings
create policy "Admin can insert settings"
  on public.settings for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update settings"
  on public.settings for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- Default commission percentage — change anytime from the Admin Dashboard
insert into public.settings (key, value) values ('commission_percent', '5')
on conflict (key) do nothing;

-- =========================================================
-- DONE.
-- =========================================================
