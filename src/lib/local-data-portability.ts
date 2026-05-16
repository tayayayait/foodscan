import { normalizePreferences } from "./preferences";
import type { SavedProductItem } from "./saved-products";
import type { OcrDraft } from "./storage";
import type {
  Nutrition,
  Product,
  ProductStatus,
  ShoppingOffer,
  SourceTag,
  UserPreferences,
} from "./types";

export const LOCAL_DATA_EXPORT_APP = "food-scan";
export const LOCAL_DATA_EXPORT_VERSION = 1;

const MAX_RECENT_PRODUCTS = 10;
const MAX_SAVED_PRODUCTS = 50;
const MAX_PROVISIONAL_PRODUCTS = 50;
const MAX_OCR_DRAFTS = 5;
const MAX_RECENT_SEARCHES = 5;

const VALID_STATUSES = new Set<ProductStatus>([
  "verified",
  "public_matched",
  "open_db_matched",
  "provisional",
  "needs_review",
]);

const VALID_SOURCES = new Set<SourceTag>([
  "verified",
  "public_api",
  "open_db",
  "ai_estimated",
  "user_submitted",
  "shopping",
]);

export interface LocalDataPayload {
  recent: Product[];
  savedProducts: SavedProductItem[];
  provisional: Product[];
  preferences: UserPreferences | null;
  ocrDrafts: OcrDraft[];
  recentSearches: string[];
}

export interface LocalDataExport {
  app: typeof LOCAL_DATA_EXPORT_APP;
  version: typeof LOCAL_DATA_EXPORT_VERSION;
  exportedAt: string;
  data: LocalDataPayload;
}

export interface LocalDataExportSummary {
  recentCount: number;
  savedCount: number;
  provisionalCount: number;
  hasPreferences: boolean;
  ocrDraftCount: number;
  recentSearchCount: number;
}

export type LocalDataImportError =
  | "invalid_json"
  | "invalid_payload"
  | "unsupported_app"
  | "unsupported_version";

export type LocalDataImportResult =
  | { ok: true; value: LocalDataExport; summary: LocalDataExportSummary }
  | { ok: false; error: LocalDataImportError };

export type LocalDataPayloadInput = Partial<Record<keyof LocalDataPayload, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim()),
    ),
  ];
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number >= 0 ? number : undefined;
}

function normalizeNutrition(value: unknown): Nutrition {
  if (!isRecord(value)) return {};
  const nutrition: Nutrition = {};
  const numberKeys = [
    "energyKcal",
    "sugarsG",
    "sodiumMg",
    "saturatedFatG",
    "proteinG",
    "fiberG",
    "fruitsVegetablesPercent",
  ] as const;

  for (const key of numberKeys) {
    const number = nonNegativeNumber(value[key]);
    if (number !== undefined) nutrition[key] = number;
  }

  const servingSize = stringValue(value.servingSize);
  if (servingSize) nutrition.servingSize = servingSize;
  return nutrition;
}

function normalizeSources(value: unknown): SourceTag[] {
  const sources = stringList(value).filter((source): source is SourceTag =>
    VALID_SOURCES.has(source as SourceTag),
  );
  return sources.length > 0 ? sources : ["user_submitted"];
}

function normalizeStatus(value: unknown): ProductStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as ProductStatus)
    ? (value as ProductStatus)
    : "provisional";
}

function normalizeConfidence(value: unknown): number {
  const confidence = finiteNumber(value);
  if (confidence === undefined) return 0;
  return Math.max(0, Math.min(1, confidence));
}

function normalizeSubmittedImages(value: unknown): Product["submittedImageUrls"] | undefined {
  if (!isRecord(value)) return undefined;
  const submittedImageUrls: NonNullable<Product["submittedImageUrls"]> = {};
  const product = stringValue(value.product);
  const nutrition = stringValue(value.nutrition);
  const ingredients = stringValue(value.ingredients);
  if (product) submittedImageUrls.product = product;
  if (nutrition) submittedImageUrls.nutrition = nutrition;
  if (ingredients) submittedImageUrls.ingredients = ingredients;
  return Object.keys(submittedImageUrls).length > 0 ? submittedImageUrls : undefined;
}

function normalizeRecall(value: unknown): Product["recall"] | undefined {
  if (!isRecord(value)) return undefined;
  const reason = stringValue(value.reason);
  const company = stringValue(value.company);
  const date = stringValue(value.date);
  if (!reason || !company || !date) return undefined;
  const grade = stringValue(value.grade);
  return {
    reason,
    company,
    date,
    ...(grade ? { grade } : {}),
  };
}

function normalizeShoppingOffer(value: unknown): ShoppingOffer | undefined {
  if (!isRecord(value)) return undefined;
  const offer: ShoppingOffer = {};
  const minPrice = nonNegativeNumber(value.minPrice);
  const maxPrice = nonNegativeNumber(value.maxPrice);
  const priceText = stringValue(value.priceText);
  const mallName = stringValue(value.mallName);
  const link = stringValue(value.link);
  const productId = stringValue(value.productId);
  const productType = stringValue(value.productType);

  if (minPrice !== undefined) offer.minPrice = minPrice;
  if (maxPrice !== undefined) offer.maxPrice = maxPrice;
  if (priceText) offer.priceText = priceText;
  if (mallName) offer.mallName = mallName;
  if (link) offer.link = link;
  if (productId) offer.productId = productId;
  if (productType) offer.productType = productType;

  return Object.keys(offer).length > 0 ? offer : undefined;
}

function normalizeProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  if (!id || !name) return null;

  const product: Product = {
    id,
    name,
    ingredients: stringList(value.ingredients),
    allergens: stringList(value.allergens),
    additives: stringList(value.additives),
    nutrition: normalizeNutrition(value.nutrition),
    sources: normalizeSources(value.sources),
    status: normalizeStatus(value.status),
    confidence: normalizeConfidence(value.confidence),
    updatedAt: stringValue(value.updatedAt) ?? new Date(0).toISOString(),
  };

  const barcode = stringValue(value.barcode);
  const reportNo = stringValue(value.reportNo);
  const brand = stringValue(value.brand);
  const category = stringValue(value.category);
  const imageUrl = stringValue(value.imageUrl);
  const quantity = stringValue(value.quantity);
  const ingredientsText = stringValue(value.ingredientsText);
  const certifications = stringList(value.certifications);
  const submittedImageUrls = normalizeSubmittedImages(value.submittedImageUrls);
  const recall = normalizeRecall(value.recall);
  const shoppingOffer = normalizeShoppingOffer(value.shoppingOffer);

  if (barcode) product.barcode = barcode;
  if (reportNo) product.reportNo = reportNo;
  if (brand) product.brand = brand;
  if (category) product.category = category;
  if (imageUrl) product.imageUrl = imageUrl;
  if (quantity) product.quantity = quantity;
  if (ingredientsText) product.ingredientsText = ingredientsText;
  if (certifications.length > 0) product.certifications = certifications;
  if (submittedImageUrls) product.submittedImageUrls = submittedImageUrls;
  if (recall) product.recall = recall;
  if (shoppingOffer) product.shoppingOffer = shoppingOffer;

  return product;
}

function uniqueProducts(value: unknown, max: number): Product[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const products: Product[] = [];

  for (const item of value) {
    const product = normalizeProduct(item);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
    if (products.length === max) break;
  }

  return products;
}

function normalizeSavedProducts(value: unknown): SavedProductItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const savedProducts: SavedProductItem[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const product = normalizeProduct(item.product);
    const savedAt = stringValue(item.savedAt);
    if (!product || !savedAt || seen.has(product.id)) continue;
    seen.add(product.id);
    savedProducts.push({ product, savedAt });
    if (savedProducts.length === MAX_SAVED_PRODUCTS) break;
  }

  return savedProducts;
}

function normalizeOcrResult(value: unknown): OcrDraft["result"] | null {
  if (!isRecord(value)) return null;
  return {
    productName: stringValue(value.productName) ?? "",
    brand: stringValue(value.brand) ?? "",
    quantity: stringValue(value.quantity) ?? "",
    category: stringValue(value.category) ?? "",
    barcode: stringValue(value.barcode) ?? "",
    ingredientsText: stringValue(value.ingredientsText) ?? "",
    ingredients: stringList(value.ingredients),
    allergens: stringList(value.allergens),
    additives: stringList(value.additives),
    nutrition: normalizeNutrition(value.nutrition),
    confidence: normalizeConfidence(value.confidence),
    warnings: stringList(value.warnings),
  };
}

function normalizeOcrDrafts(value: unknown): OcrDraft[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const drafts: OcrDraft[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = stringValue(item.id);
    const imageUrl = stringValue(item.imageUrl);
    const createdAt = stringValue(item.createdAt);
    const result = normalizeOcrResult(item.result);
    if (!id || !imageUrl || !createdAt || !result || seen.has(id)) continue;
    seen.add(id);
    drafts.push({ id, imageUrl, createdAt, result });
    if (drafts.length === MAX_OCR_DRAFTS) break;
  }

  return drafts;
}

function normalizeRecentSearches(value: unknown): string[] {
  return stringList(value).slice(0, MAX_RECENT_SEARCHES);
}

export function normalizeLocalDataPayload(input: LocalDataPayloadInput): LocalDataPayload {
  return {
    recent: uniqueProducts(input.recent, MAX_RECENT_PRODUCTS),
    savedProducts: normalizeSavedProducts(input.savedProducts),
    provisional: uniqueProducts(input.provisional, MAX_PROVISIONAL_PRODUCTS),
    preferences: input.preferences === null ? null : normalizePreferences(input.preferences),
    ocrDrafts: normalizeOcrDrafts(input.ocrDrafts),
    recentSearches: normalizeRecentSearches(input.recentSearches),
  };
}

export function buildLocalDataExport(
  input: LocalDataPayloadInput,
  exportedAt = new Date().toISOString(),
): LocalDataExport {
  return {
    app: LOCAL_DATA_EXPORT_APP,
    version: LOCAL_DATA_EXPORT_VERSION,
    exportedAt,
    data: normalizeLocalDataPayload(input),
  };
}

export function summarizeLocalDataExport(exportData: LocalDataExport): LocalDataExportSummary {
  return {
    recentCount: exportData.data.recent.length,
    savedCount: exportData.data.savedProducts.length,
    provisionalCount: exportData.data.provisional.length,
    hasPreferences: exportData.data.preferences !== null,
    ocrDraftCount: exportData.data.ocrDrafts.length,
    recentSearchCount: exportData.data.recentSearches.length,
  };
}

export function mergeLocalDataExports(
  primary: LocalDataExport,
  secondary: LocalDataExport,
  exportedAt = new Date().toISOString(),
): LocalDataExport {
  return buildLocalDataExport(
    {
      recent: [...primary.data.recent, ...secondary.data.recent],
      savedProducts: [...primary.data.savedProducts, ...secondary.data.savedProducts],
      provisional: [...primary.data.provisional, ...secondary.data.provisional],
      preferences: primary.data.preferences ?? secondary.data.preferences,
      ocrDrafts: [...primary.data.ocrDrafts, ...secondary.data.ocrDrafts],
      recentSearches: [...primary.data.recentSearches, ...secondary.data.recentSearches],
    },
    exportedAt,
  );
}

export function parseLocalDataExport(raw: string): LocalDataImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (!isRecord(parsed)) return { ok: false, error: "invalid_payload" };
  if (parsed.app !== LOCAL_DATA_EXPORT_APP) return { ok: false, error: "unsupported_app" };
  if (parsed.version !== LOCAL_DATA_EXPORT_VERSION)
    return { ok: false, error: "unsupported_version" };
  if (!isRecord(parsed.data)) return { ok: false, error: "invalid_payload" };

  const value = buildLocalDataExport(
    parsed.data as LocalDataPayloadInput,
    stringValue(parsed.exportedAt) ?? new Date().toISOString(),
  );
  return { ok: true, value, summary: summarizeLocalDataExport(value) };
}

export function localDataExportFileName(exportedAt = new Date().toISOString()) {
  const safeDate = exportedAt.replace(/\D/g, "").slice(0, 8) || "backup";
  return `food-scan-local-data-${safeDate}.json`;
}
