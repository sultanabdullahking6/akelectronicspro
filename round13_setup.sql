-- =========================================================
-- AK ELECTRONICS PRO — ROUND 13: AGENT COUPONS + MESSAGE FORWARDING
-- Run this AFTER round12_setup.sql, in the same SQL Editor.
--
-- Part A: Each agent can create/manage coupons for THEIR type only
-- Part B: Admin can selectively forward a contact message to one or
--         both agents. Messages are NOT visible to agents by default.
-- =========================================================

-- ---------------------------------------------------------
-- PART A: AGENT-SCOPED COUPONS
-- ---------------------------------------------------------
alter table public.coupons add column if not exists applies_to text default 'all' check (applies_to in ('all','product','project'));

-- Agents need to see ALL of their own type's coupons (not just active ones) to manage them
create policy "Products agent can view own coupons"
  on public.coupons for select
  using (applies_to = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can insert own coupons"
  on public.coupons for insert
  with check (applies_to = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can update own coupons"
  on public.coupons for update
  using (applies_to = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Products agent can delete own coupons"
  on public.coupons for delete
  using (applies_to = 'product' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Projects agent can view own coupons"
  on public.coupons for select
  using (applies_to = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

create policy "Projects agent can insert own coupons"
  on public.coupons for insert
  with check (applies_to = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

create policy "Projects agent can update own coupons"
  on public.coupons for update
  using (applies_to = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

create policy "Projects agent can delete own coupons"
  on public.coupons for delete
  using (applies_to = 'project' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

-- ---------------------------------------------------------
-- PART B: MESSAGE FORWARDING (admin decides, agents only see what's forwarded)
-- ---------------------------------------------------------
alter table public.messages add column if not exists sent_to_products_agent boolean default false;
alter table public.messages add column if not exists sent_to_projects_agent boolean default false;

create policy "Products agent can view forwarded messages"
  on public.messages for select
  using (sent_to_products_agent = true and (auth.jwt() -> 'user_metadata' ->> 'role') = 'products_agent');

create policy "Projects agent can view forwarded messages"
  on public.messages for select
  using (sent_to_projects_agent = true and (auth.jwt() -> 'user_metadata' ->> 'role') = 'projects_agent');

-- =========================================================
-- DONE.
-- =========================================================
