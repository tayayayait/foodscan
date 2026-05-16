alter table public.nutrition_products
add column if not exists large_category text,
add column if not exists representative_food text,
add column if not exists small_category text;

create index if not exists nutrition_products_category_idx
on public.nutrition_products (category)
where category is not null;

create index if not exists nutrition_products_representative_food_idx
on public.nutrition_products (representative_food)
where representative_food is not null;
