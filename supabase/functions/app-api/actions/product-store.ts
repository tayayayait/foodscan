import { requestSupabase } from "../_shared/supabase-rest.ts";
import type { Product, SupabaseProductRow } from "../_shared/types.ts";

export const productToSupabaseRow = (product: Product): SupabaseProductRow => ({
  id: product.id,
  barcode: product.barcode ?? null,
  report_no: product.reportNo ?? null,
  name: product.name,
  brand: product.brand ?? null,
  category: product.category ?? null,
  image_url: product.imageUrl ?? null,
  submitted_image_urls: product.submittedImageUrls ?? null,
  quantity: product.quantity ?? null,
  ingredients_text: product.ingredientsText ?? null,
  ingredients: product.ingredients,
  allergens: product.allergens,
  additives: product.additives,
  nutrition: product.nutrition,
  sources: product.sources,
  status: product.status,
  confidence: product.confidence,
  recall: product.recall ?? null,
  updated_at: product.updatedAt,
});

export const productFromSupabaseRow = (row: SupabaseProductRow): Product => ({
  id: row.id,
  barcode: row.barcode ?? undefined,
  reportNo: row.report_no ?? undefined,
  name: row.name,
  brand: row.brand ?? undefined,
  category: row.category ?? undefined,
  imageUrl: row.image_url ?? undefined,
  submittedImageUrls: row.submitted_image_urls ?? undefined,
  quantity: row.quantity ?? undefined,
  ingredientsText: row.ingredients_text ?? undefined,
  ingredients: row.ingredients ?? [],
  allergens: row.allergens ?? [],
  additives: row.additives ?? [],
  nutrition: row.nutrition ?? {},
  sources: row.sources ?? [],
  status: row.status,
  confidence: row.confidence,
  recall: row.recall ?? undefined,
  updatedAt: row.updated_at,
});

export const findSupabaseProductByField = async (field: "id" | "barcode", value: string) => {
  const rows = await requestSupabase<SupabaseProductRow[]>("products", {
    method: "GET",
    params: {
      select: "*",
      [field]: `eq.${value}`,
      status: "in.(verified,public_matched)",
      limit: "1",
    },
  });
  const row = rows?.[0];
  return row ? productFromSupabaseRow(row) : null;
};

export const lookupVerifiedProductInternal = async (idOrBarcode: string): Promise<Product | null> =>
  (await findSupabaseProductByField("id", idOrBarcode)) ??
  (await findSupabaseProductByField("barcode", idOrBarcode));

export const upsertProductInternal = async (product: Product): Promise<boolean> => {
  const rows = await requestSupabase<SupabaseProductRow[]>("products", {
    method: "POST",
    body: JSON.stringify(productToSupabaseRow(product)),
    prefer: "resolution=merge-duplicates,return=representation",
  });
  return Boolean(rows);
};
