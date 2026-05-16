import {
  ALTERNATIVE_RECOMMENDATION_SCHEMA,
  ALTERNATIVE_SHOPPING_SEARCH_SCHEMA,
  ALTERNATIVE_SHOPPING_VERIFICATION_SCHEMA,
  GEMINI_ENDPOINT,
  HttpError,
  alternativeRecommendationPrompt,
  alternativeShoppingSearchPrompt,
  alternativeShoppingVerificationPrompt,
} from "../_shared/runtime.ts";
import type {
  GeminiAlternativeShoppingPlan,
  GeminiAlternativeShoppingRecommendation,
  GeminiAlternativeShoppingSearch,
  GeminiAlternativeShoppingVerification,
  GeminiAlternativeRecommendation,
  GeminiAlternativeRecommendations,
  GeminiGenerateResponse,
  Product,
} from "../_shared/types.ts";
import {
  asNumber,
  asStringArray,
  compactNutritionForSelection,
  getGeminiApiKey,
  getGeminiModel,
  parseGeminiJson,
} from "./ocr.ts";

export const MIN_GEMINI_ALTERNATIVE_FIT_SCORE = 70;
const MAX_GEMINI_ALTERNATIVE_CANDIDATES = 30;
const MAX_GEMINI_ALTERNATIVE_SHOPPING_SEARCHES = 3;
const MAX_GEMINI_ALTERNATIVE_SHOPPING_CANDIDATES = 10;

const clampFitScore = (value: unknown) =>
  Math.max(0, Math.min(100, Math.round(asNumber(value) ?? 0)));

const isTransientGeminiStatus = (status: number) => status === 429 || status >= 500;

const emptyAlternativeRecommendations = (warning: string): GeminiAlternativeRecommendations => ({
  baseSubstituteGroup: "",
  recommendations: [],
  warnings: [warning],
});

const emptyAlternativeShoppingPlan = (warning: string): GeminiAlternativeShoppingPlan => ({
  baseNutritionBurden: "",
  searches: [],
  warnings: [warning],
});

const emptyAlternativeShoppingVerification = (
  warning: string,
): GeminiAlternativeShoppingVerification => ({
  recommendations: [],
  warnings: [warning],
});

const readGeminiPayload = async (response: Response): Promise<GeminiGenerateResponse> => {
  try {
    return (await response.json()) as GeminiGenerateResponse;
  } catch {
    return {};
  }
};

const compactProductForRecommendation = (product: Product) => ({
  id: product.id,
  barcode: product.barcode,
  reportNo: product.reportNo,
  name: product.name,
  brand: product.brand,
  category: product.category,
  quantity: product.quantity,
  ingredients: product.ingredients.slice(0, 20),
  additives: product.additives.slice(0, 20),
  allergens: product.allergens.slice(0, 20),
  nutrition: compactNutritionForSelection(product.nutrition),
  sources: product.sources,
  status: product.status,
  confidence: product.confidence,
  hasRecall: Boolean(product.recall),
  hasShoppingOffer: Boolean(product.shoppingOffer),
});

export const normalizeGeminiAlternativeRecommendations = (
  value: unknown,
  allowedProductIds: string[],
): GeminiAlternativeRecommendations => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini alternative recommendation JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const allowedIds = new Set(allowedProductIds);
  const seen = new Set<string>();
  const rawRecommendations = Array.isArray(obj.recommendations) ? obj.recommendations : [];
  const recommendations: GeminiAlternativeRecommendation[] = [];

  for (const rawRecommendation of rawRecommendations) {
    if (!rawRecommendation || typeof rawRecommendation !== "object") continue;
    if (Array.isArray(rawRecommendation)) continue;

    const recommendation = rawRecommendation as Record<string, unknown>;
    const productId =
      typeof recommendation.productId === "string" ? recommendation.productId.trim() : "";
    if (!allowedIds.has(productId) || seen.has(productId)) continue;

    seen.add(productId);
    recommendations.push({
      productId,
      fitScore: clampFitScore(recommendation.fitScore),
      substituteGroup:
        typeof recommendation.substituteGroup === "string"
          ? recommendation.substituteGroup.trim()
          : "",
      reason: typeof recommendation.reason === "string" ? recommendation.reason.trim() : "",
    });
  }

  return {
    baseSubstituteGroup:
      typeof obj.baseSubstituteGroup === "string" ? obj.baseSubstituteGroup.trim() : "",
    recommendations,
    warnings: asStringArray(obj.warnings),
  };
};

export const filterProductsByGeminiRecommendations = (
  candidates: Product[],
  judgement: GeminiAlternativeRecommendations,
  minFitScore = MIN_GEMINI_ALTERNATIVE_FIT_SCORE,
) => {
  const productsById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return judgement.recommendations
    .filter((recommendation) => recommendation.fitScore >= minFitScore)
    .map((recommendation) => productsById.get(recommendation.productId))
    .filter((product): product is Product => Boolean(product));
};

const compactText = (value: unknown, maxLength = 120) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";

export const normalizeGeminiAlternativeShoppingPlan = (
  value: unknown,
): GeminiAlternativeShoppingPlan => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini alternative shopping search JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const seenQueries = new Set<string>();
  const rawSearches = Array.isArray(obj.searches) ? obj.searches : [];
  const searches: GeminiAlternativeShoppingSearch[] = [];

  for (const rawSearch of rawSearches) {
    if (!rawSearch || typeof rawSearch !== "object" || Array.isArray(rawSearch)) continue;
    const search = rawSearch as Record<string, unknown>;
    const query = compactText(search.query, 80);
    const queryKey = query.toLocaleLowerCase();
    if (!query || seenQueries.has(queryKey)) continue;

    seenQueries.add(queryKey);
    searches.push({
      query,
      targetFood: compactText(search.targetFood, 80),
      reason: compactText(search.reason, 160),
      nutritionFocus: asStringArray(search.nutritionFocus).slice(0, 4),
    });

    if (searches.length >= MAX_GEMINI_ALTERNATIVE_SHOPPING_SEARCHES) break;
  }

  return {
    baseNutritionBurden: compactText(obj.baseNutritionBurden, 160),
    searches,
    warnings: asStringArray(obj.warnings),
  };
};

export const normalizeGeminiAlternativeShoppingVerification = (
  value: unknown,
  allowedProductIds: string[],
): GeminiAlternativeShoppingVerification => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini alternative shopping verification JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const allowedIds = new Set(allowedProductIds);
  const seen = new Set<string>();
  const rawRecommendations = Array.isArray(obj.recommendations) ? obj.recommendations : [];
  const recommendations: GeminiAlternativeShoppingRecommendation[] = [];

  for (const rawRecommendation of rawRecommendations) {
    if (!rawRecommendation || typeof rawRecommendation !== "object") continue;
    if (Array.isArray(rawRecommendation)) continue;

    const recommendation = rawRecommendation as Record<string, unknown>;
    const productId =
      typeof recommendation.productId === "string" ? recommendation.productId.trim() : "";
    if (!allowedIds.has(productId) || seen.has(productId)) continue;

    seen.add(productId);
    recommendations.push({
      productId,
      fitScore: clampFitScore(recommendation.fitScore),
      reason: compactText(recommendation.reason, 160),
      nutritionFocus: asStringArray(recommendation.nutritionFocus).slice(0, 4),
    });
  }

  return {
    recommendations,
    warnings: asStringArray(obj.warnings),
  };
};

export const assertGeminiAlternativeRecommendationProducts = (value: unknown): Product[] => {
  if (!Array.isArray(value)) {
    throw new HttpError("candidates is required");
  }
  if (value.length === 0) {
    throw new HttpError("candidates must not be empty");
  }
  if (value.length > MAX_GEMINI_ALTERNATIVE_CANDIDATES) {
    throw new HttpError("candidates exceeds maximum size");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError("candidate product is invalid");
    }
    const product = item as Product;
    if (typeof product.id !== "string" || typeof product.name !== "string") {
      throw new HttpError("candidate product is invalid");
    }
    return product;
  });
};

export const assertGeminiAlternativeShoppingProducts = (value: unknown): Product[] => {
  if (!Array.isArray(value)) {
    throw new HttpError("candidates is required");
  }
  if (value.length === 0) {
    throw new HttpError("candidates must not be empty");
  }
  if (value.length > MAX_GEMINI_ALTERNATIVE_SHOPPING_CANDIDATES) {
    throw new HttpError("candidates exceeds maximum size");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpError("candidate product is invalid");
    }
    const product = item as Product;
    if (typeof product.id !== "string" || typeof product.name !== "string") {
      throw new HttpError("candidate product is invalid");
    }
    return product;
  });
};

export const assertGeminiAlternativeShoppingSearch = (
  value: unknown,
): GeminiAlternativeShoppingSearch => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError("search is required");
  }
  const search = value as GeminiAlternativeShoppingSearch;
  if (typeof search.query !== "string" || search.query.trim().length === 0) {
    throw new HttpError("search query is required");
  }
  return {
    query: search.query.trim(),
    targetFood: typeof search.targetFood === "string" ? search.targetFood.trim() : "",
    reason: typeof search.reason === "string" ? search.reason.trim() : "",
    nutritionFocus: Array.isArray(search.nutritionFocus)
      ? search.nutritionFocus.filter((item): item is string => typeof item === "string")
      : [],
  };
};

export const recommendAlternativeProductsInternal = async (
  baseProduct: Product,
  candidates: Product[],
): Promise<GeminiAlternativeRecommendations> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const compactCandidates = candidates.map(compactProductForRecommendation);
  const response = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(getGeminiModel())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: alternativeRecommendationPrompt },
              {
                text: JSON.stringify({
                  baseProduct: compactProductForRecommendation(baseProduct),
                  candidates: compactCandidates,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: ALTERNATIVE_RECOMMENDATION_SCHEMA,
        },
      }),
    },
  );

  const payload = await readGeminiPayload(response);
  if (!response.ok) {
    if (isTransientGeminiStatus(response.status)) {
      return emptyAlternativeRecommendations(
        "Gemini alternative recommendation temporarily unavailable.",
      );
    }
    throw new HttpError(
      payload.error?.message || "Gemini alternative recommendation failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini alternative recommendation returned an empty response");
  }

  return normalizeGeminiAlternativeRecommendations(
    parseGeminiJson(text),
    candidates.map((candidate) => candidate.id),
  );
};

export const recommendAlternativeShoppingSearchesInternal = async (
  baseProduct: Product,
): Promise<GeminiAlternativeShoppingPlan> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const response = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(getGeminiModel())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: alternativeShoppingSearchPrompt },
              {
                text: JSON.stringify({
                  baseProduct: compactProductForRecommendation(baseProduct),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: ALTERNATIVE_SHOPPING_SEARCH_SCHEMA,
        },
      }),
    },
  );

  const payload = await readGeminiPayload(response);
  if (!response.ok) {
    if (isTransientGeminiStatus(response.status)) {
      return emptyAlternativeShoppingPlan(
        "Gemini alternative shopping search temporarily unavailable.",
      );
    }
    throw new HttpError(
      payload.error?.message || "Gemini alternative shopping search failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini alternative shopping search returned an empty response");
  }

  return normalizeGeminiAlternativeShoppingPlan(parseGeminiJson(text));
};

const compactShoppingCandidateForVerification = (product: Product) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: product.category,
  imageUrl: Boolean(product.imageUrl),
  mallName: product.shoppingOffer?.mallName,
  priceText: product.shoppingOffer?.priceText,
  hasLink: Boolean(product.shoppingOffer?.link),
  sources: product.sources,
});

export const verifyAlternativeShoppingResultsInternal = async (
  baseProduct: Product,
  search: GeminiAlternativeShoppingSearch,
  candidates: Product[],
): Promise<GeminiAlternativeShoppingVerification> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const response = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(getGeminiModel())}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: alternativeShoppingVerificationPrompt },
              {
                text: JSON.stringify({
                  baseProduct: compactProductForRecommendation(baseProduct),
                  search,
                  candidates: candidates.map(compactShoppingCandidateForVerification),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: ALTERNATIVE_SHOPPING_VERIFICATION_SCHEMA,
        },
      }),
    },
  );

  const payload = await readGeminiPayload(response);
  if (!response.ok) {
    if (isTransientGeminiStatus(response.status)) {
      return emptyAlternativeShoppingVerification(
        "Gemini alternative shopping verification temporarily unavailable.",
      );
    }
    throw new HttpError(
      payload.error?.message || "Gemini alternative shopping verification failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini alternative shopping verification returned an empty response");
  }

  return normalizeGeminiAlternativeShoppingVerification(
    parseGeminiJson(text),
    candidates.map((candidate) => candidate.id),
  );
};
