-- Per-user app data tables for cloud sync (Problem A: survive reinstall / new device).
-- Run this once in the Supabase SQL Editor (project: nomorebets / ibqmukrxtlimsuvnfrud).
-- Every row is isolated by RLS to the logged-in user (user_id = auth.uid()), so the anon key alone
-- can no longer read or write another account's data — the request must carry that user's JWT.
-- Anonymous (guest) sign-ins are real auth.users, so they get their own isolated rows too.

-- 1) Profile: display name / avatar / onboarding flag, one row per user.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_uri text,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Key/value mirror of the app's local AsyncStorage (records, streak, money, contacts, goals,
--    reminder settings, ...). One row per (user, key); the daily records ride in a single key as JSON.
create table if not exists public.user_kv (
  user_id uuid not null references auth.users (id) on delete cascade,
  k text not null,
  v text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

create index if not exists user_kv_user_id_idx on public.user_kv (user_id);

alter table public.profiles enable row level security;
alter table public.user_kv enable row level security;

-- Each user may only touch their own rows. (Drop-then-create keeps this script re-runnable.)
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_kv_owner_all" on public.user_kv;
create policy "user_kv_owner_all" on public.user_kv
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
