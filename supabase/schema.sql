-- LUMINA Optical — Relational PostgreSQL schema for Supabase
-- Run in Supabase SQL Editor before deploying.

create extension if not exists "pgcrypto";

-- Roles / profiles (extends auth.users when using Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('admin', 'employee', 'receptionist')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text unique not null,
  phone text,
  title text not null,
  bio text,
  image_url text,
  specialties text[] not null default '{}',
  color text not null default '#1a4a6b',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  brand text not null,
  frame_type text,
  lens_type text,
  barcode text,
  sku text unique not null,
  description text not null default '',
  images text[] not null default '{}',
  purchase_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  stock_quantity integer not null default 0,
  minimum_stock integer not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'active',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  closed boolean not null default false
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  all_day boolean not null default true
);

create table if not exists public.staff_unavailable (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  unavailable_date date not null
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  staff_id uuid not null references public.staff(id),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','completed','rescheduled')),
  notes text,
  manage_token text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent double booking for the same staff member
create unique index if not exists appointments_no_overlap_idx
  on public.appointments (staff_id, appointment_date, start_time)
  where status <> 'cancelled';

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  discount text not null,
  coupon_code text,
  image_url text,
  start_date date not null,
  end_date date not null,
  homepage_visible boolean not null default true,
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  media_type text not null check (media_type in ('image','video')),
  alt text,
  folder text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  sms_type text not null,
  status text not null,
  provider text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Document-store row used by the Next.js API (SOUL-style cascade)
create table if not exists public.lumina_store (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.lumina_store (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.settings (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.appointments enable row level security;
alter table public.promotions enable row level security;
alter table public.media enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;
alter table public.sms_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
alter table public.lumina_store enable row level security;

-- Public read for marketing content
drop policy if exists "Public read promotions" on public.promotions;
create policy "Public read promotions" on public.promotions
  for select to anon, authenticated
  using (active = true and homepage_visible = true);

drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "Public read reviews" on public.reviews;
create policy "Public read reviews" on public.reviews
  for select to anon, authenticated
  using (featured = true);

drop policy if exists "Public read media" on public.media;
create policy "Public read media" on public.media
  for select to anon, authenticated
  using (true);
