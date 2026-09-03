-- =========================================================
-- AK ELECTRONICS PRO — ROUND 10: CUSTOM ORDER INQUIRIES
-- Run this AFTER round9_setup.sql, in the same SQL Editor.
--
-- For customers who want something NOT listed on the site.
-- Two small forms (below Products, below Exhibition Projects)
-- let them leave a phone number + message. Each inquiry is
-- routed to only the relevant agent (+ admin sees everything).
-- =========================================================

create table public.custom_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  type text not null check (type in ('product', 'project')),
  phone text not null,
  message text not null,
  resolved boolean default false
);

alter table public.custom_inquiries enable row level security;

-- Anyone (even not logged in) can submit an inquiry
create policy "Public can submit custom inquiries"
  on public.custom_inquiries for insert
  with check (true);

-- Admin sees everything
create policy "Admin can view all inquiries"
  on public.custom_inquiries for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update inquiries"
  on public.custom_inquiries for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- Products agent sees only product-type inquiries
create policy "Products agent can view product inquiries"
  on public.custom_inquiries for select
  using (type = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can update product inquiries"
  on public.custom_inquiries for update
  using (type = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

-- Projects agent sees only project-type inquiries
create policy "Projects agent can view project inquiries"
  on public.custom_inquiries for select
  using (type = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

create policy "Projects agent can update project inquiries"
  on public.custom_inquiries for update
  using (type = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

-- =========================================================
-- DONE.
-- =========================================================
