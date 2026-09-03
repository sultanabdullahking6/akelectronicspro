-- =========================================================
-- AK ELECTRONICS — SUPABASE DATABASE SETUP
-- Run this ONCE in your new Supabase project's SQL Editor.
-- (Supabase dashboard → SQL Editor → New query → paste all of this → Run)
-- =========================================================

-- ---------------------------------------------------------
-- PRODUCTS (also stores exhibition "projects", via the type column)
-- ---------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  type text default 'product' check (type in ('product','project')),
  name text not null,
  category text,
  spec text,
  price numeric not null default 0,
  stock text default 'in',
  image text
);

alter table public.products enable row level security;

-- Anyone visiting the website can VIEW products
create policy "Public can view products"
  on public.products for select
  using (true);

-- No public insert/update/delete policy is created on purpose —
-- only you, from the Supabase Table Editor, can add or change items.
-- This keeps customers from being able to tamper with prices.


-- ---------------------------------------------------------
-- PROFILES (auto-created the moment someone signs up)
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: whenever someone signs up, automatically create their profile row
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_name text,
  phone text,
  address text,
  payment_method text,
  transaction_id text,
  status text default 'pending',
  total numeric not null default 0
);

alter table public.orders enable row level security;

create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------
-- ORDER ITEMS
-- ---------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text,
  price numeric,
  quantity integer default 1
);

alter table public.order_items enable row level security;

create policy "Users can view own order items"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));

create policy "Users can insert own order items"
  on public.order_items for insert
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));


-- ---------------------------------------------------------
-- SAMPLE STARTER DATA (safe to delete later from Table Editor)
-- ---------------------------------------------------------
insert into public.products (type, name, category, spec, price, stock) values
('product','PIR Motion Sensor (HC-SR501)','sensors','3.3-5V, adjustable delay & sensitivity',250,'in'),
('product','Ultrasonic Sensor HC-SR04','sensors','2-400cm range, 5V TTL',180,'in'),
('product','Arduino Uno R3 (clone)','arduino','ATmega328P, USB-B',950,'in'),
('product','ESP32 DevKit V1','esp','WROOM-32, WiFi + BLE, 30 pin',1050,'in'),
('product','Raspberry Pi Pico','raspberry','RP2040 microcontroller board',650,'in'),
('project','Smart Home Automation (ESP32 + App)','exhibition','Control lights, fan & door lock from a phone app over WiFi',4500,'in'),
('project','Obstacle-Avoiding Robot Car','exhibition','Arduino + ultrasonic sensor + L298N chassis, fully wired',3200,'in');

-- =========================================================
-- DONE. Next: Project Settings > API to get your URL + anon key
-- for config.js
-- =========================================================
