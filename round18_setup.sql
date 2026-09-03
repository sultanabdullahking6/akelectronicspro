-- =========================================================
-- AK ELECTRONICS PRO — ROUND 18: ADS BANNER (top of site)
-- Run this in Supabase SQL Editor.
-- You can upload up to 4 image ads + 1 video ad from the Admin
-- Panel; they rotate automatically in a banner at the very top
-- of the website.
-- =========================================================

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  link_url text,
  active boolean default true
);

alter table public.ads enable row level security;

create policy "Public can view active ads"
  on public.ads for select
  using (active = true);

create policy "Admin can view all ads"
  on public.ads for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can insert ads"
  on public.ads for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update ads"
  on public.ads for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete ads"
  on public.ads for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- Storage bucket for ad images/videos (reuses the same pattern as product-images)
insert into storage.buckets (id, name, public)
values ('ads-media', 'ads-media', true)
on conflict (id) do nothing;

create policy "Public can view ad media"
  on storage.objects for select
  using (bucket_id = 'ads-media');

create policy "Admin can upload ad media"
  on storage.objects for insert
  with check (bucket_id = 'ads-media' and auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete ad media"
  on storage.objects for delete
  using (bucket_id = 'ads-media' and auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
