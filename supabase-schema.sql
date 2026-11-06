-- Run this in Supabase SQL editor to create the users table
create table if not exists public.users (
  id bigint generated always as identity primary key,
  telegram_id bigint unique not null,
  first_name text,
  last_name text,
  username text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "anon can upsert own user"
  on public.users for all
  using (true) with check (true);
