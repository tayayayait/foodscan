import type { Product, RecallInfo, SourceTag, ProductStatus, Nutrition } from "./types";
import { getUnknownAdditives } from "./additive-dictionary";

export type ReviewReason =
  | "ocr_low_confidence"
  | "user_submitted"
  | "ambiguous_match"
  | "unknown_additive"
  | "api_enrichment_failed";

export interface SupabaseProductRow {
  id: string;
  barcode: string | null;
  report_no: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  submitted_image_urls: Product["submittedImageUrls"] | null;
  quantity: string | null;
  ingredients_text: string | null;
  ingredients: string[];
  allergens: string[];
  additives: string[];
  nutrition: Nutrition;
  sources: SourceTag[];
  status: ProductStatus;
  confidence: number;
  recall: RecallInfo | null;
  updated_at: string;
}

export interface ReviewQueueInsert {
  product_id: string;
  product_snapshot: Product;
  raw_payload: unknown;
  reason: ReviewReason;
  status: "pending";
  confidence: number;
  risk_flags: string[];
}

export function productToSupabaseRow(product: Product): SupabaseProductRow {
  return {
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
  };
}

export function productFromSupabaseRow(row: SupabaseProductRow): Product {
  return {
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
  };
}

function collectRiskFlags(product: Product): string[] {
  const flags = new Set<string>();
  if (product.recall) flags.add("recall");
  if (product.allergens.length > 0) flags.add("allergy");
  if (product.confidence < 0.7) flags.add("low_confidence");
  if (Object.keys(product.nutrition).length === 0) flags.add("nutrition_missing");
  if (getUnknownAdditives(product.additives).length > 0) flags.add("unknown_additive");
  return [...flags];
}

export function buildReviewQueueInsert(
  product: Product,
  reason: ReviewReason,
  rawPayload: unknown = null,
): ReviewQueueInsert {
  return {
    product_id: product.id,
    product_snapshot: product,
    raw_payload: rawPayload,
    reason,
    status: "pending",
    confidence: product.confidence,
    risk_flags: collectRiskFlags(product),
  };
}
