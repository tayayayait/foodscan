import { callAppEdgeFunction } from "./edge-function-client";
import type { Product } from "./types";

export interface ProductTranslationResult {
  product: Product;
  translated: boolean;
}

const PRODUCT_TRANSLATION_TIMEOUT_MS = 15_000;
const HANGUL_RE = /[가-힣]/;
const LATIN_WORD_RE = /[A-Za-z]{3,}/;

const hasTranslatableForeignText = (value?: string) => {
  if (!value) return false;
  return LATIN_WORD_RE.test(value) && !HANGUL_RE.test(value);
};

export function shouldTranslateProductToKorean(product: Product) {
  if (
    !product.sources.some(
      (source) => source === "public_api" || source === "open_db" || source === "ai_estimated",
    )
  ) {
    return false;
  }

  const detailFields = [
    product.category,
    product.ingredientsText,
    ...product.ingredients,
    ...product.allergens,
  ];
  if (detailFields.some(hasTranslatableForeignText)) return true;

  return product.ingredients.length === 0 && hasTranslatableForeignText(product.name);
}

export async function translateProductToKoreanIfNeeded(
  product: Product,
): Promise<ProductTranslationResult> {
  if (!shouldTranslateProductToKorean(product)) {
    return { product, translated: false };
  }

  try {
    const translatedProduct = await callAppEdgeFunction<Product>(
      "translateProductToKorean",
      {
        product,
      },
      {
        timeoutMs: PRODUCT_TRANSLATION_TIMEOUT_MS,
      },
    );
    return { product: translatedProduct, translated: true };
  } catch {
    return { product, translated: false };
  }
}
