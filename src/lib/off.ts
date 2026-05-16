import type { Product, SourceTag } from "./types";

const OFF_BASE = "https://world.openfoodfacts.org";

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_ko?: string;
  product_name_en?: string;
  brands?: string;
  categories?: string;
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  ingredients_text?: string;
  ingredients_text_ko?: string;
  ingredients_text_en?: string;
  allergens_tags?: string[];
  additives_tags?: string[];
  nutriments?: Record<string, number | string>;
  serving_size?: string;
}

const ALLERGEN_KO: Record<string, string> = {
  "en:milk": "우유",
  "en:gluten": "밀",
  "en:eggs": "계란",
  "en:soybeans": "대두",
  "en:peanuts": "땅콩",
  "en:nuts": "견과류",
  "en:fish": "생선",
  "en:crustaceans": "갑각류",
  "en:shellfish": "조개류",
  "en:molluscs": "조개류",
  "en:sesame-seeds": "참깨",
  "en:celery": "셀러리",
  "en:mustard": "겨자",
  "en:sulphur-dioxide-and-sulphites": "아황산류",
  "en:lupin": "루핀",
  "en:buckwheat": "메밀",
};

function pickName(p: OFFProduct): string {
  return p.product_name_ko || p.product_name || p.product_name_en || "이름 정보 없음";
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

export function normalizeOFF(p: OFFProduct): Product {
  const n = p.nutriments || {};
  const sodiumG = num(n["sodium_100g"]);
  const saltG = num(n["salt_100g"]);
  const sodiumMg =
    sodiumG !== undefined ? sodiumG * 1000 : saltG !== undefined ? (saltG * 1000) / 2.5 : undefined;

  const ingText = p.ingredients_text_ko || p.ingredients_text || p.ingredients_text_en || "";
  const ingredients = ingText
    .split(/[,;()]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60)
    .slice(0, 30);

  const allergens = (p.allergens_tags || []).map((t) => ALLERGEN_KO[t] || t.replace(/^en:/, ""));

  const additives = (p.additives_tags || []).map((t) => t.replace(/^en:/, "").toUpperCase());

  const sources: SourceTag[] = ["open_db"];

  return {
    id: p.code || pickName(p),
    barcode: p.code,
    name: pickName(p),
    brand: p.brands?.split(",")[0]?.trim(),
    category: p.categories?.split(",")[0]?.trim(),
    imageUrl: p.image_front_url || p.image_url,
    quantity: p.quantity,
    ingredientsText: ingText,
    ingredients,
    allergens,
    additives,
    nutrition: {
      energyKcal: num(n["energy-kcal_100g"]),
      sugarsG: num(n["sugars_100g"]),
      sodiumMg,
      saturatedFatG: num(n["saturated-fat_100g"]),
      proteinG: num(n["proteins_100g"]),
      servingSize: p.serving_size,
    },
    sources,
    status: "open_db_matched",
    confidence: 0.85,
    updatedAt: new Date().toISOString(),
  };
}

export async function getByBarcode(barcode: string): Promise<Product | null> {
  try {
    const r = await fetch(`${OFF_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json`);
    if (!r.ok) return null;
    const data = await r.json();
    if (data.status !== 1 || !data.product) return null;
    return normalizeOFF(data.product);
  } catch {
    return null;
  }
}

export async function searchByName(q: string): Promise<Product[]> {
  if (!q.trim()) return [];
  try {
    const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(
      q,
    )}&search_simple=1&action=process&json=1&page_size=20`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    const products = (data.products || []) as OFFProduct[];
    return products.slice(0, 20).map(normalizeOFF);
  } catch {
    return [];
  }
}
