create extension if not exists pgcrypto;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reported_post_id uuid references public.posts(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (
    reported_user_id is not null or reported_post_id is not null
  )
);