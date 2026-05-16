import type {
  EnvLike,
  Product,
  ProductCandidateSource,
  ProductSelectionCandidate,
} from "./types.ts";

declare const Deno: {
  env: {
    toObject(): EnvLike;
  };
};

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const FOOD_SAFETY_BASE = "https://openapi.foodsafetykorea.go.kr/api";
export const PUBLIC_NUTRITION_URL =
  "https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api";
export const PUBLIC_INGREDIENT_URL =
  "https://apis.data.go.kr/1471000/FoodRwmatrInfoService01/getFoodRwmatrList01";
export const HACCP_PACKAGING_URL =
  "https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3";
export const NAVER_SHOPPING_URL = "https://openapi.naver.com/v1/search/shop.json";
export const OPEN_FOOD_FACTS_PRODUCT_URL = "https://world.openfoodfacts.org/api/v0/product";
export const OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
export const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 12_000;

export const OCR_SCHEMA = {
  type: "object",
  properties: {
    productName: { type: "string", description: "제품 전면 또는 라벨의 제품명" },
    brand: { type: "string", description: "브랜드 또는 제조사명. 없으면 빈 문자열" },
    quantity: { type: "string", description: "총 용량 또는 포장 단위. 예: 86g" },
    category: { type: "string", description: "식품 유형 또는 카테고리" },
    barcode: { type: "string", description: "이미지에서 읽힌 숫자 바코드. 없으면 빈 문자열" },
    ingredientsText: { type: "string", description: "원재료명 원문. 없으면 빈 문자열" },
    ingredients: {
      type: "array",
      items: { type: "string" },
      description: "원재료를 쉼표 기준으로 나눈 목록",
    },
    allergens: {
      type: "array",
      items: { type: "string" },
      description: "알레르기 유발 성분 표시 또는 원재료에서 확인된 성분",
    },
    additives: {
      type: "array",
      items: { type: "string" },
      description: "식품첨가물명 또는 E-number 목록",
    },
    nutrition: {
      type: "object",
      properties: {
        energyKcal: { type: "number" },
        sugarsG: { type: "number" },
        sodiumMg: { type: "number" },
        saturatedFatG: { type: "number" },
        proteinG: { type: "number" },
        servingSize: { type: "string" },
      },
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "이미지 판독과 구조화 결과에 대한 종합 신뢰도",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "흐림, 가림, 단위 불확실성 등 사용자에게 알려야 할 사항",
    },
  },
  required: [
    "productName",
    "brand",
    "quantity",
    "category",
    "barcode",
    "ingredientsText",
    "ingredients",
    "allergens",
    "additives",
    "nutrition",
    "confidence",
    "warnings",
  ],
};

export const ocrPrompt = `
한국 식품 라벨 사진에서 제품 정보를 추출하라.
규칙:
- 공식 데이터가 아니라 AI OCR 추정값이므로 보이는 정보만 구조화한다.
- 읽히지 않는 값은 빈 문자열 또는 빈 배열로 둔다.
- 영양성분은 100g/ml 기준으로 환산 가능한 경우만 숫자로 입력한다.
- 나트륨은 mg, 당류/포화지방/단백질은 g, 열량은 kcal 단위로 입력한다.
- confidence는 흐림, 일부 가림, 손글씨, 단위 불확실성, 필드 누락을 반영해 0부터 1 사이로 산정한다.
`;

export const PRODUCT_SELECTION_SCHEMA = {
  type: "object",
  properties: {
    selectedIndex: {
      type: "number",
      description: "Zero-based index of the selected candidate.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence in the candidate selection.",
    },
    reason: {
      type: "string",
      description: "Brief Korean explanation for the selected candidate.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Data quality warnings, if any.",
    },
  },
  required: ["selectedIndex", "confidence", "reason", "warnings"],
};

export const ALTERNATIVE_FIT_SCHEMA = {
  type: "object",
  properties: {
    baseSubstituteGroup: {
      type: "string",
      description: "Consumer-facing food form/use group for the base product.",
    },
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "Candidate product id copied exactly from input.",
          },
          isSubstitute: {
            type: "boolean",
            description: "True only when the candidate can replace the base product in normal use.",
          },
          fitScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Semantic substitute fit score from 0 to 100.",
          },
          substituteGroup: {
            type: "string",
            description: "Candidate's food form/use group.",
          },
          reason: {
            type: "string",
            description: "Brief Korean explanation.",
          },
        },
        required: ["productId", "isSubstitute", "fitScore", "substituteGroup", "reason"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Data quality warnings, if any.",
    },
  },
  required: ["baseSubstituteGroup", "decisions", "warnings"],
};

export const ALTERNATIVE_RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    baseSubstituteGroup: {
      type: "string",
      description: "Consumer-facing food form/use group for the scanned base product.",
    },
    recommendations: {
      type: "array",
      description: "Ordered recommended candidate product ids. Best recommendation first.",
      items: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "Candidate product id copied exactly from input.",
          },
          fitScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Substitute recommendation fit score from 0 to 100.",
          },
          substituteGroup: {
            type: "string",
            description: "Candidate's consumer-facing food form/use group.",
          },
          reason: {
            type: "string",
            description: "Brief Korean explanation for why this candidate is recommended.",
          },
        },
        required: ["productId", "fitScore", "substituteGroup", "reason"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Data quality warnings, if any.",
    },
  },
  required: ["baseSubstituteGroup", "recommendations", "warnings"],
};

export const ALTERNATIVE_SHOPPING_SEARCH_SCHEMA = {
  type: "object",
  properties: {
    baseNutritionBurden: {
      type: "string",
      description: "Brief Korean summary of the base product's main nutrition burden.",
    },
    searches: {
      type: "array",
      description: "Naver Shopping search plans for nutritionally better alternative foods.",
      items: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Short Korean Naver Shopping search query.",
          },
          targetFood: {
            type: "string",
            description: "Consumer-facing alternative food concept.",
          },
          reason: {
            type: "string",
            description: "Brief Korean nutritional reason.",
          },
          nutritionFocus: {
            type: "array",
            items: { type: "string" },
            description:
              "Nutrition improvements such as lower sugar, lower sodium, protein, fiber.",
          },
        },
        required: ["query", "targetFood", "reason", "nutritionFocus"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Data quality warnings, if any.",
    },
  },
  required: ["baseNutritionBurden", "searches", "warnings"],
};

export const ALTERNATIVE_SHOPPING_VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      description:
        "Ordered Naver Shopping result ids that match the nutritional alternative intent.",
      items: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "Naver Shopping candidate product id copied exactly from input.",
          },
          fitScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Fit score for the search intent and nutritional replacement role.",
          },
          reason: {
            type: "string",
            description: "Brief Korean explanation for why this shopping result is acceptable.",
          },
          nutritionFocus: {
            type: "array",
            items: { type: "string" },
            description: "Nutrition direction inferred from product naming, not verified facts.",
          },
        },
        required: ["productId", "fitScore", "reason", "nutritionFocus"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Data quality warnings, if any.",
    },
  },
  required: ["recommendations", "warnings"],
};

export const FOOD_PAIRING_SCHEMA = {
  type: "object",
  properties: {
    overallStrategy: {
      type: "string",
      description: "Brief Korean summary of the nutrition balancing strategy.",
    },
    pairings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          foods: {
            type: "array",
            items: { type: "string" },
            description: "Common non-branded foods to eat together with the base product.",
          },
          reason: {
            type: "string",
            description: "Brief Korean nutrition rationale for this pairing.",
          },
          nutritionFocus: {
            type: "array",
            items: { type: "string" },
            description: "Nutrition balancing points such as protein, fiber, sodium, sugar.",
          },
          caution: {
            type: "string",
            description: "Optional Korean caution. Use empty string when none.",
          },
          fitScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Nutrition pairing fit score from 0 to 100.",
          },
        },
        required: ["foods", "reason", "nutritionFocus", "caution", "fitScore"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Data quality or general caution warnings, if any.",
    },
  },
  required: ["overallStrategy", "pairings", "warnings"],
};

export const productSelectionPrompt = `
You choose the best product record for a scanned barcode after every lookup source has been checked.
Rules:
- Return only JSON matching the schema.
- selectedIndex must be one of the supplied candidate indexes.
- Do not invent, merge, or rewrite product data. Choose exactly one existing candidate.
- Prefer exact barcode matches, verified/official public records, complete nutrition/ingredient data, and higher confidence.
- Penalize generic names, missing barcode, sparse data, and low confidence.
- Write reason and warnings in Korean.
`;

export const alternativeFitPrompt = `
You judge whether candidate food products are true substitutes for the base product.
Return only JSON matching the schema.

Rules:
- Do not invent products or rewrite product data. Judge only supplied candidates.
- Gemini owns the substitute judgement. Do not rely on keyword overlap, shared flavor words, broad categories, or generic health positioning.
- First infer the narrow baseSubstituteGroup from the base product's actual food form, eating experience, serving occasion, storage/packaging, preparation method, and purchase intent.
- A substitute means a normal consumer could reasonably replace the base product with the candidate without changing the product format they intended to buy or eat.
- Reject products that only share a broad ingredient or category but are a different dish, meal, snack type, beverage type, or preparation form.
- Do not mark a candidate as a substitute only because it is healthier, lower calorie, lower sugar, chocolate-flavored, or sold in the same aisle.
- For example, canned ham/luncheon meat is not substitutable with cooked pork trotter even if both are processed meat.
- fitScore 70 or higher means acceptable substitute fit. Below 70 means do not recommend.
- Return one decision for every supplied candidate id.
- Write reason, substituteGroup, baseSubstituteGroup, and warnings in Korean.
`;

export const alternativeRecommendationPrompt = `
You recommend substitute food products for a scanned barcode product.
Return only JSON matching the schema.

Rules:
- The baseProduct has already been selected from barcode/public data lookup. Use it as the current product.
- Recommend only supplied candidate product ids. Do not invent products, brands, nutrition facts, prices, links, or images.
- Gemini owns the substitute judgement. Do not rely on keyword overlap, shared flavor words, broad categories, or generic health positioning.
- First infer the narrow baseSubstituteGroup from the base product's actual food form, eating experience, serving occasion, storage/packaging, preparation method, and purchase intent.
- Rank recommendations by true substitute fit first, then nutrition improvement, then source reliability.
- A substitute means a normal consumer could reasonably replace the base product with the candidate without changing the product format they intended to buy or eat.
- Broad official categories are not enough. Compare product form, flavor/use context, serving occasion, storage/packaging, preparation method, product naming, and expected eating experience.
- Do not recommend a candidate only because it is healthier, lower calorie, lower sugar, chocolate-flavored, or sold in the same aisle.
- Prefer candidates with lower sugar, sodium, saturated fat, calories, or fewer additives when they are still realistic substitutes.
- Exclude candidates below fitScore 70.
- If no supplied candidate is a true substitute, return an empty recommendations array.
- Return at most 6 recommendations, ordered best first.
- Write reason, substituteGroup, baseSubstituteGroup, and warnings in Korean.
`;

export const alternativeShoppingSearchPrompt = `
You create Naver Shopping search queries for nutritionally better alternative foods for a scanned barcode product.
Return only JSON matching the schema.

Rules:
- Interpret the base product from name, category, ingredients, additives, allergens, nutrition, quantity, and source reliability.
- Identify the main nutrition burden: sugar, sodium, saturated fat, calories, additive load, low protein, or low fiber.
- Create practical Korean Naver Shopping search queries for foods a normal consumer might buy instead from a nutritional perspective.
- Search queries may describe an alternative food concept. Do not invent specific product facts, nutrition facts, prices, links, images, or verified brands.
- Prefer concrete food types with nutrition modifiers, for example lower sugar, low sodium, high protein, whole grain, high fiber, no sugar added, or reduced saturated fat.
- Keep the alternative in a realistic consumption role: snack for snack, drink for drink, sauce for sauce, ready meal for ready meal, staple for staple. A different format is allowed only when it is a practical nutritional replacement for the same eating occasion.
- Do not make disease treatment, weight-loss, medical, detox, or supplement claims.
- Return at most 3 searches. Each query should be short enough for Naver Shopping and should not include a price.
- Write baseNutritionBurden, targetFood, reason, nutritionFocus, and warnings in Korean.
`;

export const alternativeShoppingVerificationPrompt = `
You verify Naver Shopping result candidates for a nutrition-oriented alternative food search.
Return only JSON matching the schema.

Rules:
- Use the base product, the Gemini search plan, and the supplied Naver Shopping result candidates.
- Recommend only supplied candidate product ids. Do not invent products, nutrition facts, prices, links, images, brands, or sellers.
- A valid result must plausibly match the search plan's target food and nutrition direction from the product title/category/seller context.
- Reject the original product, same-product bundles, unrelated foods, supplements, medicines, diet/medical claim products, kitchen tools, books, ads, and non-food items.
- Do not assume nutrition facts. Use nutritionFocus only as an inferred direction from words such as low sugar, low sodium, high protein, whole grain, high fiber, unsweetened, or reduced fat.
- Prefer results that are concrete foods a normal consumer can buy and use in the same eating occasion.
- Return at most 3 recommendations ordered best first. Return an empty recommendations array when no result is acceptable.
- fitScore 70 or higher means acceptable. Below 70 means do not recommend.
- Write reason, nutritionFocus, and warnings in Korean.
`;

export const foodPairingPrompt = `
You recommend nutritionally complementary foods to eat with the scanned product.
Return only JSON matching the schema.

Rules:
- This is general nutrition guidance, not medical advice, disease treatment, weight-loss coaching, or diagnosis.
- Use only the supplied product nutrition, ingredients, allergens, additives, category, and source quality. Do not invent or rewrite product data.
- Recommend common real foods or simple food combinations, not branded products, supplements, medicines, or paid placements.
- Focus on balancing likely nutrition gaps or burdens: protein, dietary fiber, unsaturated fats, hydration, lower added sugar, lower sodium, or portion balance.
- Avoid pairings that worsen the product's main nutrition burden. For high-sugar products, do not recommend sugary drinks or desserts. For high-sodium products, do not recommend salty soups, pickles, processed meats, or salty sauces.
- If the product has allergen labels or common allergen risks, mention label checking in caution when relevant.
- Recommend at most 3 pairings. Each pairing should be practical for a normal consumer meal or snack context.
- Write overallStrategy, reason, nutritionFocus, caution, and warnings in Korean.
`;

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

export const fetchWithTimeout = async (
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
  timeoutMessage = "Upstream request timed out",
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(timeoutMessage, 504, "UPSTREAM_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const env = (): EnvLike => Deno.env.toObject();
export const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const assertObject = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpError("Invalid input");
  }
  return data as Record<string, unknown>;
};

export const requiredString = (data: Record<string, unknown>, key: string) => {
  const value = data[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(`${key} is required`);
  }
  return value.trim();
};

export const optionalString = (data: Record<string, unknown>, key: string) => {
  const value = data[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

export const assertProduct = (value: unknown): Product => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError("product is required");
  }
  const product = value as Product;
  if (typeof product.id !== "string" || typeof product.name !== "string") {
    throw new HttpError("product is invalid");
  }
  return product;
};

export const PRODUCT_CANDIDATE_SOURCES = new Set<ProductCandidateSource>([
  "local",
  "public_api",
  "open_food_facts",
]);

export const assertProductSelectionCandidates = (value: unknown): ProductSelectionCandidate[] => {
  if (!Array.isArray(value)) {
    throw new HttpError("candidates is required");
  }
  if (value.length === 0) {
    throw new HttpError("candidates must not be empty");
  }
  if (value.length > 8) {
    throw new HttpError("candidates exceeds maximum size");
  }

  return value.map((item) => {
    const candidate = assertObject(item);
    const source = candidate.source;
    if (
      typeof source !== "string" ||
      !PRODUCT_CANDIDATE_SOURCES.has(source as ProductCandidateSource)
    ) {
      throw new HttpError("candidate source is invalid");
    }
    return {
      source: source as ProductCandidateSource,
      product: assertProduct(candidate.product),
    };
  });
};
