create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  pin_salt text not null,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$')
);

create table if not exists public.app_user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_user_data (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_user_data_snapshot_app check (snapshot->>'app' = 'food-scan'),
  constraint app_user_data_snapshot_version check ((snapshot->>'version')::int = 1)
);

create index if not exists app_user_sessions_user_id_idx
on public.app_user_sessions (user_id);

create index if not exists app_user_sessions_expires_at_idx
on public.app_user_sessions (expires_at);

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists app_user_data_set_updated_at on public.app_user_data;
create trigger app_user_data_set_updated_at
before update on public.app_user_data
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.app_user_sessions enable row level security;
alter table public.app_user_data enable row level security;
