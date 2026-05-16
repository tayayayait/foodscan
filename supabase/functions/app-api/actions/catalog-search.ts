import {
  NAVER_SHOPPING_URL,
  OPEN_FOOD_FACTS_PRODUCT_URL,
  OPEN_FOOD_FACTS_SEARCH_URL,
  env,
} from "../_shared/runtime.ts";
import { htmlToText, pickCategory } from "../_shared/normalizers.ts";
import type {
  NaverShoppingItem,
  NaverShoppingResponse,
  OpenFoodFactsProduct,
  OpenFoodFactsProductResponse,
  OpenFoodFactsSearchResponse,
  Product,
  ShoppingOffer,
} from "../_shared/types.ts";
import { HttpError } from "../_shared/runtime.ts";

export const getNaverCredentials = () => {
  const currentEnv = env();
  return {
    clientId: currentEnv.NAVER_SHOPPING_CLIENT_ID || currentEnv.NAVER_CLIENT_ID || "",
    clientSecret: currentEnv.NAVER_SHOPPING_CLIENT_SECRET || currentEnv.NAVER_CLIENT_SECRET || "",
  };
};

export const parseNaverPrice = (value?: string) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const formatKrw = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export const naverPriceText = (minPrice?: number, maxPrice?: number) => {
  if (minPrice !== undefined && maxPrice !== undefined && maxPrice > minPrice) {
    return `${formatKrw(minPrice)}~${formatKrw(maxPrice)}`;
  }
  if (minPrice !== undefined) return `최저 ${formatKrw(minPrice)}`;
  if (maxPrice !== undefined) return `최고 ${formatKrw(maxPrice)}`;
  return undefined;
};

export const naverShoppingItemToProduct = (item: NaverShoppingItem): Product => {
  const name = htmlToText(item.title) || "쇼핑 검색 상품";
  const id = `naver-${item.productId || encodeURIComponent(name).slice(0, 80)}`;
  const category = pickCategory(item.category4, item.category3, item.category2, item.category1);
  const minPrice = parseNaverPrice(item.lprice);
  const maxPrice = parseNaverPrice(item.hprice);
  const priceText = naverPriceText(minPrice, maxPrice);
  const shoppingOffer: ShoppingOffer = {
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(priceText ? { priceText } : {}),
    ...(item.mallName ? { mallName: item.mallName } : {}),
    ...(item.link ? { link: item.link } : {}),
    ...(item.productId ? { productId: item.productId } : {}),
    ...(item.productType ? { productType: item.productType } : {}),
  };

  return {
    id,
    name,
    brand: pickCategory(item.brand, item.maker, item.mallName),
    category,
    imageUrl: item.image,
    ingredients: [],
    allergens: [],
    additives: [],
    nutrition: {},
    sources: ["shopping"],
    status: "open_db_matched",
    confidence: 0.55,
    ...(Object.keys(shoppingOffer).length > 0 ? { shoppingOffer } : {}),
    updatedAt: new Date().toISOString(),
  };
};

export const OFF_ALLERGEN_KO: Record<string, string> = {
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

export const num = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
};

const isTransientOpenFoodFactsStatus = (status: number) => status === 429 || status >= 500;

export const pickOpenFoodFactsName = (product: OpenFoodFactsProduct) =>
  product.product_name_ko || product.product_name || product.product_name_en || "이름 정보 없음";

export const openFoodFactsProductToProduct = (product: OpenFoodFactsProduct): Product => {
  const nutriments = product.nutriments || {};
  const sodiumG = num(nutriments["sodium_100g"]);
  const saltG = num(nutriments["salt_100g"]);
  const sodiumMg =
    sodiumG !== undefined ? sodiumG * 1000 : saltG !== undefined ? (saltG * 1000) / 2.5 : undefined;
  const ingredientsText =
    product.ingredients_text_ko || product.ingredients_text || product.ingredients_text_en || "";

  return {
    id: product.code || pickOpenFoodFactsName(product),
    barcode: product.code,
    name: pickOpenFoodFactsName(product),
    brand: product.brands?.split(",")[0]?.trim(),
    category: product.categories?.split(",")[0]?.trim(),
    imageUrl: product.image_front_url || product.image_url,
    quantity: product.quantity,
    ingredientsText,
    ingredients: ingredientsText
      .split(/[,;()]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.length < 60)
      .slice(0, 30),
    allergens: (product.allergens_tags || []).map(
      (tag) => OFF_ALLERGEN_KO[tag] || tag.replace(/^en:/, ""),
    ),
    additives: (product.additives_tags || []).map((tag) => tag.replace(/^en:/, "").toUpperCase()),
    nutrition: {
      energyKcal: num(nutriments["energy-kcal_100g"]),
      sugarsG: num(nutriments["sugars_100g"]),
      sodiumMg,
      saturatedFatG: num(nutriments["saturated-fat_100g"]),
      proteinG: num(nutriments["proteins_100g"]),
      servingSize: product.serving_size,
    },
    sources: ["open_db"],
    status: "open_db_matched",
    confidence: 0.85,
    updatedAt: new Date().toISOString(),
  };
};

export const searchOpenFoodFactsInternal = async (
  query: string,
  limit = 20,
): Promise<Product[]> => {
  if (!query.trim()) return [];

  const url = new URL(OPEN_FOOD_FACTS_SEARCH_URL);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(Math.min(Math.max(limit, 1), 50)));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "KFoodScan/phase5 (public food data contest)",
      },
    });
  } catch {
    return [];
  }
  if (!response.ok) {
    if (isTransientOpenFoodFactsStatus(response.status)) return [];
    throw new HttpError("Open Food Facts search failed", response.status);
  }
  const payload = (await response.json()) as OpenFoodFactsSearchResponse;
  return (payload.products ?? []).map(openFoodFactsProductToProduct);
};

export const lookupOpenFoodFactsByBarcodeInternal = async (
  barcode: string,
): Promise<Product | null> => {
  const normalized = barcode.replace(/\D/g, "");
  if (!normalized) return null;

  let response: Response;
  try {
    response = await fetch(
      `${OPEN_FOOD_FACTS_PRODUCT_URL}/${encodeURIComponent(normalized)}.json`,
      {
        headers: {
          "User-Agent": "KFoodScan/phase5 (public food data contest)",
        },
      },
    );
  } catch {
    return null;
  }
  if (!response.ok) {
    if (isTransientOpenFoodFactsStatus(response.status)) return null;
    throw new HttpError("Open Food Facts barcode lookup failed", response.status);
  }

  const payload = (await response.json()) as OpenFoodFactsProductResponse;
  if (payload.status !== 1 || !payload.product) return null;
  return openFoodFactsProductToProduct(payload.product);
};

export const searchNaverShoppingInternal = async (query: string, limit = 5): Promise<Product[]> => {
  const { clientId, clientSecret } = getNaverCredentials();
  if (!clientId || !clientSecret) return [];

  const url = new URL(NAVER_SHOPPING_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.min(Math.max(limit, 1), 20)));
  url.searchParams.set("sort", "sim");
  url.searchParams.set("exclude", "used:rental:cbshop");

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  const payload = (await response.json()) as NaverShoppingResponse;
  if (!response.ok) {
    throw new HttpError(payload.errorMessage || "Naver Shopping search failed", response.status);
  }

  return (payload.items ?? []).map(naverShoppingItemToProduct);
};
