-- =========================================================
-- AK ELECTRONICS PRO — ROUND 7: AGENT LOGINS
-- Run this AFTER round6_setup.sql, in the same SQL Editor.
--
-- Adds two restricted "agent" roles who can log into admin.html
-- but only manage ONE section each:
--   - products_agent  → can only add/edit/delete rows where type='product'
--   - projects_agent  → can only add/edit/delete rows where type='project'
-- The main admin (abdullahsultan6@gmail.com) keeps full access to both.
--
-- IMPORTANT: This SQL only sets up the PERMISSIONS. You still need to
-- create the two agent accounts yourself in the Supabase Dashboard —
-- see the instructions Claude gave you for exact steps.
-- =========================================================

-- Products agent: can manage rows of type='product' only
create policy "Products agent can insert products"
  on public.products for insert
  with check (type = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can update products"
  on public.products for update
  using (type = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can delete products"
  on public.products for delete
  using (type = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

-- Projects agent: can manage rows of type='project' only
create policy "Projects agent can insert projects"
  on public.products for insert
  with check (type = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

create policy "Projects agent can update projects"
  on public.products for update
  using (type = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

create policy "Projects agent can delete projects"
  on public.products for delete
  using (type = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

-- Both agents can also upload/manage images in Storage (needed for their uploads)
create policy "Agents can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'user_metadata' ->> 'role') in ('products_agent', 'projects_agent')
  );

create policy "Agents can update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'user_metadata' ->> 'role') in ('products_agent', 'projects_agent')
  );

create policy "Agents can delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'user_metadata' ->> 'role') in ('products_agent', 'projects_agent')
  );

-- =========================================================
-- DONE.
-- =========================================================
