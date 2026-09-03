-- =========================================================
-- AK ELECTRONICS PRO — ROUND 3 FEATURES SETUP
-- Run this AFTER round2_setup.sql, in the same SQL Editor.
-- Adds: Blog posts, PDF Datasheet links on products
-- =========================================================

-- ---------------------------------------------------------
-- BLOG POSTS
-- ---------------------------------------------------------
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  slug text unique not null,
  excerpt text,
  content text not null,
  cover_image text,
  published boolean default true
);

alter table public.blog_posts enable row level security;

-- Anyone can read published posts
create policy "Public can view published posts"
  on public.blog_posts for select
  using (published = true);

-- Only admin can manage posts (and see drafts)
create policy "Admin can view all posts"
  on public.blog_posts for select
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can insert posts"
  on public.blog_posts for insert
  with check (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can update posts"
  on public.blog_posts for update
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');

create policy "Admin can delete posts"
  on public.blog_posts for delete
  using (auth.jwt() ->> 'email' = 'abdullahsultan6@gmail.com');


-- ---------------------------------------------------------
-- DATASHEET LINK on products/projects
-- ---------------------------------------------------------
alter table public.products add column if not exists datasheet_url text;


-- ---------------------------------------------------------
-- SAMPLE STARTER BLOG POST (safe to edit/delete from Admin Panel)
-- ---------------------------------------------------------
insert into public.blog_posts (title, slug, excerpt, content, published) values
(
  'Getting Started with Arduino: Your First LED Blink',
  'getting-started-arduino-led-blink',
  'New to Arduino? Here''s the simplest possible project to get your board talking to the real world.',
  E'If you just unboxed your first Arduino Uno, the "Blink" sketch is the classic first project — and for good reason.\n\nWhat you need:\n- Arduino Uno (or compatible clone)\n- 1 LED\n- 1 220-ohm resistor\n- Breadboard + jumper wires\n\nWiring:\nConnect the LED''s longer leg (anode) through the resistor to pin 13, and the shorter leg (cathode) to GND.\n\nCode:\nOpen the Arduino IDE, go to File > Examples > Basics > Blink, and upload it. That''s it — your LED should start blinking every second.\n\nThis simple exercise teaches you the two most important Arduino concepts: pinMode() and digitalWrite(). From here, you can move on to reading sensors, controlling motors, and eventually full IoT projects with ESP32.',
  true
);

-- =========================================================
-- DONE.
-- =========================================================
