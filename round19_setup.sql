-- =========================================================
-- AK ELECTRONICS PRO — ROUND 19: WEBSITE BUILDING SERVICE
-- Run this in Supabase SQL Editor.
-- A new homepage section advertises that you also build custom
-- websites. Leads go ONLY to you (never to agents).
-- =========================================================

create table public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  phone text not null,
  message text not null,
  resolved boolean default false
);

alter table public.website_inquiries enable row level security;

create policy "Public can submit website inquiries"
  on public.website_inquiries for insert
  with check (true);

create policy "Admin can view website inquiries"
  on public.website_inquiries for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update website inquiries"
  on public.website_inquiries for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
