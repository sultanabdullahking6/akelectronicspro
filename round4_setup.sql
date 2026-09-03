-- =========================================================
-- AK ELECTRONICS PRO — ROUND 4: REAL CUSTOMER REVIEWS
-- Run this AFTER round3_setup.sql, in the same SQL Editor.
-- =========================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  customer_name text,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  unique(product_id, user_id)
);

alter table public.reviews enable row level security;

-- Everyone can read reviews (this is what builds trust for other shoppers)
create policy "Public can view reviews"
  on public.reviews for select
  using (true);

-- Only logged-in users can write a review, and only as themselves
create policy "Users can add own review"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own review"
  on public.reviews for update
  using (auth.uid() = user_id);

create policy "Users can delete own review"
  on public.reviews for delete
  using (auth.uid() = user_id);

create policy "Admin can delete any review"
  on public.reviews for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

-- =========================================================
-- DONE.
-- =========================================================
