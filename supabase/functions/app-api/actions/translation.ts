import {
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  GEMINI_ENDPOINT,
  HttpError,
  fetchWithTimeout,
} from "../_shared/runtime.ts";
import type {
  GeminiGenerateResponse,
  Product,
  ProductKoreanTranslation,
} from "../_shared/types.ts";
import { asStringArray, getGeminiApiKey, getGeminiModel, parseGeminiJson } from "./ocr.ts";

export const PRODUCT_TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "Korean display name. Keep brand names and proper nouns when translation is unsafe.",
    },
    category: { type: "string", description: "Korean product category, or empty string." },
    ingredientsText: {
      type: "string",
      description: "Korean translation of the full ingredient text, preserving facts and order.",
    },
    ingredients: {
      type: "array",
      items: { type: "string" },
      description: "Korean ingredient names in the same order and count as the input ingredients.",
    },
    allergens: {
      type: "array",
      items: { type: "string" },
      description: "Korean allergen names in the same order and count as the input allergens.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Brief Korean warnings for uncertain translations.",
    },
  },
  required: ["name", "category", "ingredientsText", "ingredients", "allergens", "warnings"],
};

export const productTranslationPrompt = `
Translate foreign-language food product text into Korean for display.
Return only JSON matching the schema.

Rules:
- Do not add, remove, or reorder ingredients or allergens.
- The ingredients array must have the same length and order as input.ingredients.
- The allergens array must have the same length and order as input.allergens.
- Preserve E-numbers, food additive codes, percentages, quantities, units, and legal codes.
- Keep brand names and product proper nouns unchanged when a reliable Korean equivalent is not obvious.
- Translate generic food terms, ingredient names, allergen names, and category names into Korean.
- If a field is empty, return an empty value of the same shape.
- If unsure about one item, copy that original item instead of guessing.
`;

const cleanString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeTranslatedList = (value: unknown, fallback: string[]) => {
  const translated = asStringArray(value).map((item) => item.trim());
  return fallback.map((original, index) => translated[index] || original);
};

export function normalizeProductKoreanTranslation(
  value: unknown,
  product: Product,
): ProductKoreanTranslation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini product translation JSON is not an object");
  }

  const obj = value as Record<string, unknown>;
  return {
    name: cleanString(obj.name) || product.name,
    category: cleanString(obj.category) || product.category || "",
    ingredientsText: cleanString(obj.ingredientsText) || product.ingredientsText || "",
    ingredients: normalizeTranslatedList(obj.ingredients, product.ingredients),
    allergens: normalizeTranslatedList(obj.allergens, product.allergens),
    warnings: asStringArray(obj.warnings)
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function applyKoreanProductTranslation(
  product: Product,
  translation: ProductKoreanTranslation,
): Product {
  return {
    ...product,
    name: translation.name || product.name,
    category: translation.category || product.category,
    ingredientsText: translation.ingredientsText || product.ingredientsText,
    ingredients: translation.ingredients.length > 0 ? translation.ingredients : product.ingredients,
    allergens: translation.allergens.length > 0 ? translation.allergens : product.allergens,
  };
}

const compactProductForTranslation = (product: Product) => ({
  name: product.name,
  brand: product.brand || "",
  category: product.category || "",
  quantity: product.quantity || "",
  ingredientsText: product.ingredientsText || "",
  ingredients: product.ingredients,
  allergens: product.allergens,
  additives: product.additives,
});

export const translateProductToKoreanInternal = async (product: Product): Promise<Product> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError("GEMINI_API_KEY is not configured", 500, "NO_GEMINI_API_KEY");
  }

  const response = await fetchWithTimeout(
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
              { text: productTranslationPrompt },
              { text: JSON.stringify({ product: compactProductForTranslation(product) }) },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: PRODUCT_TRANSLATION_SCHEMA,
        },
      }),
    },
    DEFAULT_UPSTREAM_TIMEOUT_MS,
    "Gemini product translation timed out",
  );

  const payload = (await response.json()) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new HttpError(
      payload.error?.message || "Gemini product translation failed",
      response.status,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join("\n");

  if (!text) {
    throw new Error("Gemini product translation returned an empty response");
  }

  return applyKoreanProductTranslation(
    product,
    normalizeProductKoreanTranslation(parseGeminiJson(text), product),
  );
};
