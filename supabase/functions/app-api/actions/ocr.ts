import {
  GEMINI_ENDPOINT,
  MAX_INLINE_IMAGE_BYTES,
  OCR_SCHEMA,
  PRODUCT_SELECTION_SCHEMA,
  assertObject,
  env,
  requiredString,
  ocrPrompt,
  productSelectionPrompt,
  HttpError,
} from "../_shared/runtime.ts";
import {
  firstNumber,
  normalizeBarcode,
  normalizeComparable,
  uniqueStrings,
} from "../_shared/normalizers.ts";
import { enrichProductInternal } from "./enrichment.ts";
import { mergeNutritionPreferIncoming } from "./nutrition.ts";
import type {
  GeminiGenerateResponse,
  GeminiOcrResult,
  Nutrition,
  Product,
  ProductCandidateSelection,
  ProductSelectionCandidate,
  SourceTag,
} from "../_shared/types.ts";

export const getGeminiApiKey = () =>
  env().GEMINI_API_KEY || env().GOOGLE_GENERATIVE_AI_API_KEY || "";

export const getGeminiModel = () => env().GEMINI_OCR_MODEL || "gemini-3-flash-preview";

export const validateOcrInput = (data: unknown) => {
  const input = assertObject(data);
  const imageBase64 = requiredString(input, "imageBase64").replace(/^data:[^,]+,/, "");
  const mimeType = requiredString(input, "mimeType");

  if (!mimeType.startsWith("image/")) {
    throw new HttpError("Valid image mimeType is required");
  }

  const approximateBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (approximateBytes > MAX_INLINE_IMAGE_BYTES) {
    throw new HttpError("Image exceeds 10MB limit", 413, "IMAGE_TOO_LARGE");
  }

  return { imageBase64, mimeType };
};

export const parseGeminiJson = (text: string): unknown => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match?.[1]) return JSON.parse(match[1]);

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }

  throw new Error("Gemini returned no JSON object");
};

export const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const normalizeOcrResult = (value: unknown): GeminiOcrResult => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini OCR JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const nutrition =
    obj.nutrition && typeof obj.nutrition === "object" && !Array.isArray(obj.nutrition)
      ? (obj.nutrition as Record<string, unknown>)
      : {};
  const confidence = asNumber(obj.confidence) ?? 0;

  return {
    productName: typeof obj.productName === "string" ? obj.productName.trim() : "",
    brand: typeof obj.brand === "string" ? obj.brand.trim() : "",
    quantity: typeof obj.quantity === "string" ? obj.quantity.trim() : "",
    category: typeof obj.category === "string" ? obj.category.trim() : "",
    barcode: typeof obj.barcode === "string" ? obj.barcode.replace(/\D/g, "") : "",
    ingredientsText: typeof obj.ingredientsText === "string" ? obj.ingredientsText.trim() : "",
    ingredients: asStringArray(obj.ingredients)
      .map((item) => item.trim())
      .filter(Boolean),
    allergens: asStringArray(obj.allergens)
      .map((item) => item.trim())
      .filter(Boolean),
    additives: asStringArray(obj.additives)
      .map((item) => item.trim())
      .filter(Boolean),
    nutrition: {
      energyKcal: asNumber(nutrition.energyKcal),
      sugarsG: asNumber(nutrition.sugarsG),
      sodiumMg: asNumber(nutrition.sodiumMg),
      saturatedFatG: asNumber(nutrition.saturatedFatG),
      proteinG: asNumber(nutrition.proteinG),
      servingSize:
        typeof nutrition.servingSize === "string" ? nutrition.servingSize.trim() : undefined,
    },
    confidence: Math.max(0, Math.min(1, confidence)),
    warnings: asStringArray(obj.warnings),
  };
};

const OCR_UNREADABLE_WARNING_PATTERN =
  /판독\s*불가|확인(?:이)?\s*어렵|흐릿|가려|보이지|읽을\s*수\s*없|not\s+readable|unreadable|unclear/i;

export const removeUnreadableZeroNutrition = (result: GeminiOcrResult): GeminiOcrResult => {
  if (!result.warnings.some((warning) => OCR_UNREADABLE_WARNING_PATTERN.test(warning))) {
    return result;
  }

  const nutrition = { ...result.nutrition };
  for (const key of ["sugarsG", "sodiumMg", "saturatedFatG", "proteinG"] as const) {
    if (nutrition[key] === 0) {
      nutrition[key] = undefined;
    }
  }

  return { ...result, nutrition };
};

export const ocrResultToProduct = (result: GeminiOcrResult): Product => ({
  id: result.barcode || `ocr-${normalizeComparable(result.productName) || Date.now()}`,
  barcode: result.barcode || undefined,
  name: result.productName || "AI OCR 제품",
  brand: result.brand || undefined,
  category: result.category || undefined,
  quantity: result.quantity || undefined,
  ingredientsText: result.ingredientsText || undefined,
  ingredients: result.ingredients,
  allergens: result.allergens,
  additives: result.additives,
  nutrition: result.nutrition,
  sources: ["ai_estimated"] as SourceTag[],
  status: "provisional",
  confidence: result.confidence,
  updatedAt: new Date().toISOString(),
});

export const mergeOcrWithEnrichedProduct = (
  result: GeminiOcrResult,
  product: Product,
): GeminiOcrResult => {
  const warnings = [...result.warnings];
  const hadNoIngredients = result.ingredients.length === 0 && result.ingredientsText.length === 0;

  if (hadNoIngredients && product.ingredients.length > 0) {
    warnings.push(
      "사진에서 원재료 표가 직접 판독되지 않아 제품명 기반 공공데이터 후보로 보강했습니다.",
    );
  }

  return {
    ...result,
    productName: result.productName || product.name,
    brand: result.brand || product.brand || "",
    quantity: result.quantity || product.quantity || "",
    category: result.category || product.category || "",
    barcode: result.barcode || product.barcode || "",
    ingredientsText: result.ingredientsText || product.ingredientsText || "",
    ingredients: uniqueStrings([...result.ingredients, ...product.ingredients]),
    allergens: uniqueStrings([...result.allergens, ...product.allergens]),
    additives: uniqueStrings([...result.additives, ...product.additives]),
    nutrition: mergeNutritionPreferIncoming(result.nutrition, product.nutrition),
    warnings: uniqueStrings(warnings),
  };
};

export const enrichOcrResult = async (result: GeminiOcrResult): Promise<GeminiOcrResult> => {
  if (!result.productName && !result.barcode) return result;

  try {
    const product = await enrichProductInternal(ocrResultToProduct(result));
    return mergeOcrWithEnrichedProduct(result, product);
  } catch (error) {
    console.error("OCR enrichment failed", error);
    return result;
  }
};

export const compactNutritionForSelection = (nutrition: Nutrition) => ({
  energyKcal: nutrition.energyKcal,
  sugarsG: nutrition.sugarsG,
  sodiumMg: nutrition.sodiumMg,
  saturatedFatG: nutrition.saturatedFatG,
  proteinG: nutrition.proteinG,
  servingSize: nutrition.servingSize,
});

export const compactProductForSelection = (
  barcode: string,
  candidate: ProductSelectionCandidate,
  index: number,
) => {
  const product = candidate.product;
  return {
    index,
    source: candidate.source,
    barcodeMatch: Boolean(
      product.barcode && normalizeBarcode(product.barcode) === normalizeBarcode(barcode),
    ),
    product: {
      id: product.id,
      barcode: product.barcode,
      reportNo: product.reportNo,
      name: product.name,
      brand: product.brand,
      category: product.category,
      quantity: product.quantity,
      ingredientsText: product.ingredientsText?.slice(0, 1200),
      ingredients: product.ingredients.slice(0, 40),
      allergens: product.allergens.slice(0, 30),
      additives: product.additives.slice(0, 30),
      nutrition: compactNutritionForSelection(product.nutrition),
      sources: product.sources,
      status: product.status,
      confidence: product.confidence,
      hasImage: Boolean(product.imageUrl),
      recall: product.recall,
      updatedAt: product.updatedAt,
    },
  };
};

export const normalizeProductCandidateSelection = (
  value: unknown,
  candidateCount: number,
): ProductCandidateSelection => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini product selection JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  const selectedIndex = asNumber(obj.selectedIndex);
  if (
    selectedIndex === undefined ||
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= candidateCount
  ) {
    throw new Error("Gemini product selection index is invalid");
  }

  const confidence = asNumber(obj.confidence) ?? 0;
  return {
    selectedIndex,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason: typeof obj.reason === "string" ? obj.reason.trim() : "",
    warnings: asStringArray(obj.warnings),
  };
};

export const selectBestProductCandidateInternal = async (
  barcode: string,
  candidates: ProductSelectionCandidate[],
): Promise<ProductCandidateSelection> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const compactCandidates = candidates.map((candidate, index) =>
    compactProductForSelection(barcode, candidate, index),
  );
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
              { text: productSelectionPrompt },
              {
                text: JSON.stringify({
                  barcode,
                  candidates: compactCandidates,
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: PRODUCT_SELECTION_SCHEMA,
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new HttpError(
      payload.error?.message || "Gemini product selection failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini product selection returned an empty response");
  }

  return normalizeProductCandidateSelection(parseGeminiJson(text), candidates.length);
};

export const analyzeFoodImageInternal = async (input: {
  imageBase64: string;
  mimeType: string;
}): Promise<GeminiOcrResult> => {
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
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.imageBase64,
                },
              },
              { text: ocrPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: OCR_SCHEMA,
        },
      }),
    },
  );

  const payload = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new HttpError(payload.error?.message || "Gemini OCR request failed", response.status);
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini OCR returned an empty response");
  }

  return enrichOcrResult(removeUnreadableZeroNutrition(normalizeOcrResult(parseGeminiJson(text))));
};
