import {
  ALTERNATIVE_FIT_SCHEMA,
  GEMINI_ENDPOINT,
  HttpError,
  alternativeFitPrompt,
  assertProduct,
} from "../_shared/runtime.ts";
import type {
  AlternativeFitDecision,
  AlternativeFitJudgement,
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

export const MIN_ALTERNATIVE_FIT_SCORE = 70;
const MAX_ALTERNATIVE_FIT_CANDIDATES = 30;

const clampFitScore = (value: unknown) =>
  Math.max(0, Math.min(100, Math.round(asNumber(value) ?? 0)));

const compactProductForAlternativeFit = (product: Product) => ({
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
});

export const normalizeAlternativeFitJudgement = (
  value: unknown,
  allowedProductIds: string[],
): AlternativeFitJudgement => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini alternative fit JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const allowedIds = new Set(allowedProductIds);
  const seen = new Set<string>();
  const rawDecisions = Array.isArray(obj.decisions) ? obj.decisions : [];
  const decisions: AlternativeFitDecision[] = [];

  for (const rawDecision of rawDecisions) {
    if (!rawDecision || typeof rawDecision !== "object" || Array.isArray(rawDecision)) continue;
    const decision = rawDecision as Record<string, unknown>;
    const productId = typeof decision.productId === "string" ? decision.productId.trim() : "";
    if (!allowedIds.has(productId) || seen.has(productId)) continue;

    seen.add(productId);
    decisions.push({
      productId,
      isSubstitute: decision.isSubstitute === true,
      fitScore: clampFitScore(decision.fitScore),
      substituteGroup:
        typeof decision.substituteGroup === "string" ? decision.substituteGroup.trim() : "",
      reason: typeof decision.reason === "string" ? decision.reason.trim() : "",
    });
  }

  return {
    baseSubstituteGroup:
      typeof obj.baseSubstituteGroup === "string" ? obj.baseSubstituteGroup.trim() : "",
    decisions,
    warnings: asStringArray(obj.warnings),
  };
};

export const filterProductsByAlternativeFit = (
  candidates: Product[],
  judgement: AlternativeFitJudgement,
  minFitScore = MIN_ALTERNATIVE_FIT_SCORE,
) => {
  const decisionsById = new Map(
    judgement.decisions.map((decision) => [decision.productId, decision]),
  );
  return candidates.filter((candidate) => {
    const decision = decisionsById.get(candidate.id);
    return Boolean(decision?.isSubstitute && decision.fitScore >= minFitScore);
  });
};

export const assertAlternativeFitProducts = (value: unknown): Product[] => {
  if (!Array.isArray(value)) {
    throw new HttpError("candidates is required");
  }
  if (value.length === 0) {
    throw new HttpError("candidates must not be empty");
  }
  if (value.length > MAX_ALTERNATIVE_FIT_CANDIDATES) {
    throw new HttpError("candidates exceeds maximum size");
  }
  return value.map(assertProduct);
};

export const judgeAlternativeFitInternal = async (
  baseProduct: Product,
  candidates: Product[],
): Promise<AlternativeFitJudgement> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const compactCandidates = candidates.map(compactProductForAlternativeFit);
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
              { text: alternativeFitPrompt },
              {
                text: JSON.stringify({
                  baseProduct: compactProductForAlternativeFit(baseProduct),
                  candidates: compactCandidates,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: ALTERNATIVE_FIT_SCHEMA,
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new HttpError(
      payload.error?.message || "Gemini alternative fit judgement failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini alternative fit judgement returned an empty response");
  }

  return normalizeAlternativeFitJudgement(
    parseGeminiJson(text),
    candidates.map((candidate) => candidate.id),
  );
};
