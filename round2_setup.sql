-- =========================================================
-- AK ELECTRONICS PRO — ROUND 2 FEATURES SETUP
-- Run this AFTER supabase_setup.sql, admin_setup.sql, and
-- features_setup.sql, in the same SQL Editor.
-- Adds: Contact messages, Newsletter subscribers, Saved addresses
-- =========================================================

-- ---------------------------------------------------------
-- CONTACT MESSAGES
-- ---------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  message text not null,
  read boolean default false
);

alter table public.messages enable row level security;

-- Anyone (even not logged in) can submit a contact message
create policy "Public can send messages"
  on public.messages for insert
  with check (true);

-- Only the admin can read/manage messages
create policy "Admin can view messages"
  on public.messages for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update messages"
  on public.messages for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete messages"
  on public.messages for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');


-- ---------------------------------------------------------
-- NEWSLETTER SUBSCRIBERS
-- ---------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text unique not null
);

alter table public.newsletter_subscribers enable row level security;

create policy "Public can subscribe"
  on public.newsletter_subscribers for insert
  with check (true);

create policy "Admin can view subscribers"
  on public.newsletter_subscribers for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');


-- ---------------------------------------------------------
-- SAVED ADDRESSES (address book, per customer)
-- ---------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  label text default 'Home',
  address text not null
);

alter table public.addresses enable row level security;

create policy "Users can view own addresses"
  on public.addresses for select
  using (auth.uid() = user_id);

create policy "Users can add own addresses"
  on public.addresses for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own addresses"
  on public.addresses for delete
  using (auth.uid() = user_id);

-- =========================================================
-- DONE.
-- =========================================================
