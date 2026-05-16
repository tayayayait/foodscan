import type { Product, SourceTag } from "./types.ts";

export const splitIngredients = (raw: string) =>
  raw
    .split(/[,;()·]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length < 80)
    .slice(0, 40);

const BRACKETED_CONTENT_PATTERN = /\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】/g;
const CORPORATE_SUFFIX_PATTERN =
  /㈜|\(주\)|주식회사|농업회사법인|영농조합법인|유한회사|합자회사|합명회사/g;

export const normalizeSearchTerm = (value?: string) =>
  (value ?? "")
    .replace(BRACKETED_CONTENT_PATTERN, " ")
    .replace(CORPORATE_SUFFIX_PATTERN, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeComparable = (value?: string) =>
  normalizeSearchTerm(value).replace(/\s+/g, "").toLowerCase();
export const normalizeBarcode = (value?: string) => (value ?? "").replace(/\D/g, "");

export const pickCategory = (...values: Array<string | undefined>) =>
  values.find((value) => value && value.trim().length > 0)?.trim();

const QUANTITY_UNIT_PATTERN =
  /\d+(?:[.,]\d+)?\s*(?:kg|g|mg|l|ml|개(?!월)|매|봉|팩|입|캔|병|정|포|세트|ea|pcs?)/i;
const SHELF_LIFE_PATTERN = /제조일|소비기한|유통기한|품질유지기한|개월|년|일까지/;

export const normalizePackageQuantity = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (SHELF_LIFE_PATTERN.test(trimmed) && !QUANTITY_UNIT_PATTERN.test(trimmed)) return undefined;
  return trimmed;
};

export const valueAsString = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

export const firstString = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = valueAsString(row[key]);
    if (value.length > 0) return value;
  }
  return undefined;
};

export const firstNumber = (row: Record<string, unknown>, keys: string[]) => {
  const value = firstString(row, keys);
  if (!value) return undefined;
  const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const uniqueStrings = (values: string[]) => [
  ...new Set(values.filter((value) => value.trim())),
];

export const htmlToText = (value?: string) =>
  (value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export const createPublicProduct = ({
  id,
  barcode,
  reportNo,
  name,
  brand,
  category,
  quantity,
  confidence,
}: {
  id: string;
  barcode?: string;
  reportNo?: string;
  name?: string;
  brand?: string;
  category?: string;
  quantity?: string;
  confidence: number;
}): Product => ({
  id,
  barcode,
  reportNo,
  name: name?.trim() || "이름 정보 없음",
  brand: brand?.trim() || undefined,
  category: category?.trim() || undefined,
  quantity: normalizePackageQuantity(quantity),
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: ["public_api"],
  status: "public_matched",
  confidence,
  updatedAt: new Date().toISOString(),
});
