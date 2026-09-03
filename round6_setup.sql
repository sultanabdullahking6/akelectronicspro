-- =========================================================
-- AK ELECTRONICS PRO — ROUND 6: DIRECT IMAGE UPLOAD
-- Run this AFTER round5_setup.sql, in the same SQL Editor.
-- Creates a public storage bucket so the Admin Panel can upload
-- product photos directly — no more manual renaming/folders.
-- =========================================================

-- Create the storage bucket (public so images load on the website)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Anyone can VIEW images (needed for them to show on the website)
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Only the admin can upload new images
create policy "Admin can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- Only the admin can replace/delete images
create policy "Admin can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
