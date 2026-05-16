import {
  FOOD_PAIRING_SCHEMA,
  GEMINI_ENDPOINT,
  HttpError,
  foodPairingPrompt,
} from "../_shared/runtime.ts";
import type {
  FoodPairingJudgement,
  FoodPairingRecommendation,
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

export const MAX_FOOD_PAIRINGS = 3;

const clampFitScore = (value: unknown) =>
  Math.max(0, Math.min(100, Math.round(asNumber(value) ?? 0)));

const uniqueTrimmed = (values: string[], limit: number) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
};

export const compactProductForFoodPairing = (product: Product) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: product.category,
  quantity: product.quantity,
  ingredients: product.ingredients.slice(0, 30),
  allergens: product.allergens.slice(0, 20),
  additives: product.additives.slice(0, 20),
  nutrition: compactNutritionForSelection(product.nutrition),
  sources: product.sources,
  status: product.status,
  confidence: product.confidence,
});

export const normalizeFoodPairingJudgement = (
  value: unknown,
  limit = MAX_FOOD_PAIRINGS,
): FoodPairingJudgement => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini food pairing JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const rawPairings = Array.isArray(obj.pairings) ? obj.pairings : [];
  const pairings: FoodPairingRecommendation[] = [];

  for (const rawPairing of rawPairings) {
    if (!rawPairing || typeof rawPairing !== "object" || Array.isArray(rawPairing)) continue;

    const pairing = rawPairing as Record<string, unknown>;
    const foods = uniqueTrimmed(asStringArray(pairing.foods), 4);
    const reason = typeof pairing.reason === "string" ? pairing.reason.trim() : "";
    const nutritionFocus = uniqueTrimmed(asStringArray(pairing.nutritionFocus), 4);
    const caution = typeof pairing.caution === "string" ? pairing.caution.trim() : "";

    if (foods.length === 0 || !reason || nutritionFocus.length === 0) continue;

    pairings.push({
      foods,
      reason,
      nutritionFocus,
      caution: caution || undefined,
      fitScore: clampFitScore(pairing.fitScore),
    });

    if (pairings.length >= limit) break;
  }

  return {
    overallStrategy: typeof obj.overallStrategy === "string" ? obj.overallStrategy.trim() : "",
    pairings,
    warnings: uniqueTrimmed(asStringArray(obj.warnings), 5),
  };
};

export const recommendFoodPairingsInternal = async (
  product: Product,
): Promise<FoodPairingJudgement> => {
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
              { text: foodPairingPrompt },
              {
                text: JSON.stringify({
                  product: compactProductForFoodPairing(product),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: FOOD_PAIRING_SCHEMA,
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new HttpError(
      payload.error?.message || "Gemini food pairing recommendation failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini food pairing recommendation returned an empty response");
  }

  return normalizeFoodPairingJudgement(parseGeminiJson(text));
};
