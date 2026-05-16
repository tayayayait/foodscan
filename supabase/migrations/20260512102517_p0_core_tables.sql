create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.products (
  id text primary key,
  barcode text unique,
  report_no text,
  name text not null,
  brand text,
  category text,
  image_url text,
  submitted_image_urls jsonb,
  quantity text,
  ingredients_text text,
  ingredients text[] not null default '{}',
  allergens text[] not null default '{}',
  additives text[] not null default '{}',
  nutrition jsonb not null default '{}',
  sources text[] not null default '{}',
  status text not null default 'provisional'
    check (status in ('verified', 'public_matched', 'open_db_matched', 'provisional', 'needs_review')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  recall jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create table if not exists public.review_queue (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  product_snapshot jsonb not null,
  raw_payload jsonb,
  reason text not null
    check (reason in (
      'ocr_low_confidence',
      'user_submitted',
      'ambiguous_match',
      'unknown_additive',
      'api_enrichment_failed'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  risk_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_queue_status_idx on public.review_queue (status, created_at desc);
create index if not exists review_queue_product_id_idx on public.review_queue (product_id);

create table if not exists public.ocr_drafts (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  result jsonb not null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending'
    check (status in ('pending', 'attached', 'discarded')),
  created_at timestamptz not null default now()
);

create table if not exists public.recall_cache (
  product_id text primary key,
  recall jsonb,
  lookup_error text,
  checked_at timestamptz not null default now()
);

create table if not exists public.additive_review_queue (
  id uuid primary key default gen_random_uuid(),
  additive_name text not null,
  product_id text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists review_queue_set_updated_at on public.review_queue;
create trigger review_queue_set_updated_at
before update on public.review_queue
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.review_queue enable row level security;
alter table public.ocr_drafts enable row level security;
alter table public.recall_cache enable row level security;
alter table public.additive_review_queue enable row level security;

drop policy if exists "public_read_verified_products" on public.products;
create policy "public_read_verified_products"
on public.products for select
to anon, authenticated
using (status in ('verified', 'public_matched'));

drop policy if exists "public_submit_provisional_products" on public.products;
create policy "public_submit_provisional_products"
on public.products for insert
to anon, authenticated
with check (status in ('provisional', 'needs_review'));

drop policy if exists "public_update_provisional_products" on public.products;
create policy "public_update_provisional_products"
on public.products for update
to anon, authenticated
using (status in ('provisional', 'needs_review'))
with check (status in ('provisional', 'needs_review'));

drop policy if exists "public_insert_review_queue" on public.review_queue;
create policy "public_insert_review_queue"
on public.review_queue for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "public_insert_ocr_drafts" on public.ocr_drafts;
create policy "public_insert_ocr_drafts"
on public.ocr_drafts for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "public_read_recall_cache" on public.recall_cache;
create policy "public_read_recall_cache"
on public.recall_cache for select
to anon, authenticated
using (true);

drop policy if exists "public_insert_additive_review_queue" on public.additive_review_queue;
create policy "public_insert_additive_review_queue"
on public.additive_review_queue for insert
to anon, authenticated
with check (status = 'pending');
