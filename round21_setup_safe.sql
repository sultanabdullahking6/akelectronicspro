-- =========================================================
-- AK ELECTRONICS PRO — ROUND 21 (SAFE VERSION)
-- Run this in Supabase SQL Editor. Safe to run even if some
-- of these policies already exist — drops and recreates them.
-- =========================================================

-- Custom Inquiries
drop policy if exists "Admin can delete inquiries" on public.custom_inquiries;
drop policy if exists "Products agent can delete product inquiries" on public.custom_inquiries;
drop policy if exists "Projects agent can delete project inquiries" on public.custom_inquiries;

create policy "Admin can delete inquiries"
  on public.custom_inquiries for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Products agent can delete product inquiries"
  on public.custom_inquiries for delete
  using (type = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Projects agent can delete project inquiries"
  on public.custom_inquiries for delete
  using (type = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

-- Website Building Leads (admin only)
drop policy if exists "Admin can delete website inquiries" on public.website_inquiries;

create policy "Admin can delete website inquiries"
  on public.website_inquiries for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- Restock Notifications (admin only)
drop policy if exists "Admin can delete restock notifications" on public.restock_notifications;

create policy "Admin can delete restock notifications"
  on public.restock_notifications for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
