create table if not exists public.nutrition_products (
  food_code text primary key,
  report_no text,
  name text not null,
  normalized_name text not null,
  manufacturer text,
  normalized_manufacturer text,
  category text,
  large_category text,
  representative_food text,
  small_category text,
  basis_amount text,
  serving_size text,
  food_weight text,
  energy_kcal numeric,
  sugars_g numeric,
  sodium_mg numeric,
  saturated_fat_g numeric,
  protein_g numeric,
  source_name text,
  data_created_date date,
  data_basis_date date,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_products
add column if not exists large_category text,
add column if not exists representative_food text,
add column if not exists small_category text;

create index if not exists nutrition_products_report_no_idx
on public.nutrition_products (report_no)
where report_no is not null;

create index if not exists nutrition_products_category_idx
on public.nutrition_products (category)
where category is not null;

create index if not exists nutrition_products_representative_food_idx
on public.nutrition_products (representative_food)
where representative_food is not null;

create index if not exists nutrition_products_normalized_name_idx
on public.nutrition_products (normalized_name);

create index if not exists nutrition_products_normalized_manufacturer_idx
on public.nutrition_products (normalized_manufacturer)
where normalized_manufacturer is not null;

create index if not exists nutrition_products_name_trgm_idx
on public.nutrition_products using gin (name gin_trgm_ops);

create index if not exists nutrition_products_manufacturer_trgm_idx
on public.nutrition_products using gin (manufacturer gin_trgm_ops)
where manufacturer is not null;

drop trigger if exists nutrition_products_set_updated_at on public.nutrition_products;
create trigger nutrition_products_set_updated_at
before update on public.nutrition_products
for each row execute function public.set_updated_at();

alter table public.nutrition_products enable row level security;

drop policy if exists "public_read_nutrition_products" on public.nutrition_products;
create policy "public_read_nutrition_products"
on public.nutrition_products for select
to anon, authenticated
using (true);
