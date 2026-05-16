import { normalizeComparable, normalizeSearchTerm, uniqueStrings } from "../_shared/normalizers.ts";
import {
  lookupOpenFoodFactsByBarcodeInternal,
  searchNaverShoppingInternal,
} from "./catalog-search.ts";
import {
  lookupHaccpPackagingInternal,
  lookupHaccpPackagingByBarcodeInternal,
} from "./haccp-packaging.ts";
import { lookupC002Internal, searchI1250Internal } from "./product-lookup.ts";
import { detectAdditivesFromIngredients } from "./ingredients.ts";
import { lookupI0490Internal } from "./recall.ts";
import {
  lookupNutritionStandardInternal,
  mergeNutrition,
  nutritionNeedsEnrichment,
} from "./nutrition.ts";
import type { Product } from "../_shared/types.ts";

const hasIngredients = (product: Product) =>
  product.ingredients.length > 0 || Boolean(product.ingredientsText?.trim());

const containsComparable = (left: string, right: string) =>
  Boolean(left && right && (left.includes(right) || right.includes(left)));

const isNameMatch = (candidate: Product, target: Product) => {
  const candidateName = normalizeComparable(candidate.name);
  const targetName = normalizeComparable(target.name);
  return candidateName === targetName || containsComparable(candidateName, targetName);
};

const isBrandMatch = (candidate: Product, target: Product) => {
  const candidateBrand = normalizeComparable(candidate.brand);
  const targetBrand = normalizeComparable(target.brand);
  return containsComparable(candidateBrand, targetBrand);
};

const GENERIC_INGREDIENT_LABELS = new Set(["식품첨가물"]);

const hasGenericIngredientLabel = (ingredients: string[]) =>
  ingredients.some((ingredient) => GENERIC_INGREDIENT_LABELS.has(ingredient.trim()));

const shouldUsePackagingIngredients = (
  currentIngredients: string[],
  packagingIngredients: string[],
) => {
  if (packagingIngredients.length === 0) return false;
  if (currentIngredients.length === 0) return true;
  if (
    hasGenericIngredientLabel(currentIngredients) &&
    !hasGenericIngredientLabel(packagingIngredients)
  ) {
    return true;
  }
  return packagingIngredients.length > currentIngredients.length;
};

export const mergeHaccpPackagingInfo = (
  product: Product,
  packaging: {
    ingredientsText?: string;
    ingredients: string[];
    allergens: string[];
    imageUrl?: string;
    quantity?: string;
  },
): Product => {
  const merged = { ...product };

  if (shouldUsePackagingIngredients(product.ingredients, packaging.ingredients)) {
    merged.ingredients = packaging.ingredients;
    merged.ingredientsText = packaging.ingredientsText;
  }

  if (packaging.allergens.length > 0) {
    merged.allergens = uniqueStrings([...product.allergens, ...packaging.allergens]);
  }
  if (!merged.imageUrl && packaging.imageUrl) {
    merged.imageUrl = packaging.imageUrl;
  }
  if (!merged.quantity && packaging.quantity) {
    merged.quantity = packaging.quantity;
  }

  return merged;
};

export const buildProductImageSearchQueries = (product: Product) => {
  const cleanedBrand = normalizeSearchTerm(product.brand);
  const cleanedName = normalizeSearchTerm(product.name);
  return uniqueStrings([
    cleanedBrand && cleanedName ? `${cleanedBrand} ${cleanedName}` : "",
    cleanedName,
    product.name?.trim() ?? "",
  ]);
};

export const selectPhotoEnrichmentCandidate = (
  candidates: Product[],
  target: Product,
): Product | null => {
  const ingredientCandidates = candidates.filter((candidate) => hasIngredients(candidate));
  if (ingredientCandidates.length === 0) return null;

  const targetBrand = normalizeComparable(target.brand);
  const targetName = normalizeComparable(target.name);

  if (targetBrand) {
    return (
      ingredientCandidates
        .filter((candidate) => isNameMatch(candidate, target) && isBrandMatch(candidate, target))
        .sort((a, b) => b.ingredients.length - a.ingredients.length)[0] ?? null
    );
  }

  const exactNameCandidates = ingredientCandidates.filter(
    (candidate) => normalizeComparable(candidate.name) === targetName,
  );
  return exactNameCandidates.length === 1 ? exactNameCandidates[0] : null;
};

export const selectShoppingImageCandidate = (
  candidates: Product[],
  target: Product,
): Product | null => {
  if (target.imageUrl) return null;

  const targetName = normalizeComparable(target.name);
  if (!targetName) return null;

  const targetBrand = normalizeComparable(target.brand);
  const scoredCandidates = candidates
    .map((candidate, index) => {
      if (!candidate.imageUrl) return null;

      const candidateName = normalizeComparable(candidate.name);
      if (!candidateName || !containsComparable(candidateName, targetName)) return null;

      let score = candidateName === targetName ? 6 : 4;
      if (targetBrand && isBrandMatch(candidate, target)) score += 2;
      if (
        target.category &&
        candidate.category &&
        normalizeComparable(candidate.category).includes(normalizeComparable(target.category))
      ) {
        score += 1;
      }
      return { candidate, index, score };
    })
    .filter((item): item is { candidate: Product; index: number; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return scoredCandidates[0]?.candidate ?? null;
};

export const enrichProductInternal = async (product: Product): Promise<Product> => {
  const enriched: Product = { ...product };
  enriched.ingredients = enriched.ingredients ?? [];
  enriched.additives = enriched.additives ?? [];
  enriched.allergens = enriched.allergens ?? [];
  enriched.nutrition = enriched.nutrition ?? {};

  if (enriched.reportNo) {
    const packaging = await lookupHaccpPackagingInternal(enriched.reportNo);
    if (packaging) {
      Object.assign(enriched, mergeHaccpPackagingInfo(enriched, packaging));
      if (!enriched.reportNo && packaging.reportNo) {
        enriched.reportNo = packaging.reportNo;
      }
    }
  }

  // Fallback: barcode 기반 HACCP 조회 (식품안전나라 API 한도 초과 시 대비)
  if (enriched.ingredients.length === 0 && enriched.barcode && !enriched.reportNo) {
    try {
      const barcodePackaging = await lookupHaccpPackagingByBarcodeInternal(enriched.barcode);
      if (barcodePackaging) {
        Object.assign(enriched, mergeHaccpPackagingInfo(enriched, barcodePackaging));
        if (!enriched.reportNo && barcodePackaging.reportNo) {
          enriched.reportNo = barcodePackaging.reportNo;
        }
      }
    } catch {
      // HACCP barcode fallback 실패는 무시하고 다음 단계로 진행
    }
  }

  if (enriched.ingredients.length === 0 && enriched.reportNo) {
    try {
      const ingredientInfo = await lookupC002Internal(enriched.reportNo);
      if (ingredientInfo.ingredients.length > 0) {
        enriched.ingredients = ingredientInfo.ingredients;
        enriched.ingredientsText = ingredientInfo.ingredientsText;
      }
    } catch {
      // C002 API 한도 초과 시 무시하고 다음 fallback으로 진행
    }
  }

  if (enriched.ingredients.length === 0 && (enriched.reportNo || enriched.barcode)) {
    try {
      const candidates = await searchI1250Internal(enriched.name, 5);
      const match = candidates.find((candidate) => {
        if (candidate.name === enriched.name) return true;
        return Boolean(enriched.brand && candidate.brand === enriched.brand);
      });
      if (match && match.ingredients.length > 0) {
        enriched.reportNo = enriched.reportNo || match.reportNo;
        enriched.ingredients = match.ingredients;
        enriched.ingredientsText = match.ingredientsText;
      }
    } catch {
      // I1250 API 한도 초과 시 무시하고 다음 단계로 진행
    }
  }

  if (!enriched.barcode && enriched.name && enriched.ingredients.length < 3) {
    const candidates = await searchI1250Internal(enriched.name, 10);
    const match = selectPhotoEnrichmentCandidate(candidates, enriched);
    if (match) {
      enriched.reportNo = enriched.reportNo || match.reportNo;
      enriched.ingredients = uniqueStrings([...enriched.ingredients, ...match.ingredients]);
      enriched.ingredientsText = enriched.ingredientsText || match.ingredientsText;
    }
  }

  if (nutritionNeedsEnrichment(enriched.nutrition)) {
    const nutrition = await lookupNutritionStandardInternal(
      enriched.name,
      enriched.brand,
      enriched.reportNo,
      enriched.nutrition,
      enriched.ingredientsText,
    );
    if (nutrition) {
      enriched.nutrition = mergeNutrition(enriched.nutrition, nutrition.nutrition);
    }
  }

  if (enriched.ingredients.length > 0) {
    const additives = await detectAdditivesFromIngredients(enriched.ingredients);
    if (additives.length > 0) {
      enriched.additives = uniqueStrings([...enriched.additives, ...additives]);
    }
  }

  if (!enriched.imageUrl && enriched.barcode) {
    try {
      const openFoodFactsProduct = await lookupOpenFoodFactsByBarcodeInternal(enriched.barcode);
      if (openFoodFactsProduct?.imageUrl) {
        enriched.imageUrl = openFoodFactsProduct.imageUrl;
        if (!enriched.sources.includes("open_db")) {
          enriched.sources = [...enriched.sources, "open_db"];
        }
      }
    } catch {
      // Open Food Facts images are optional; continue to shopping fallback.
    }
  }

  if (!enriched.imageUrl) {
    try {
      for (const query of buildProductImageSearchQueries(enriched)) {
        const shoppingCandidates = await searchNaverShoppingInternal(query, 5);
        const match = selectShoppingImageCandidate(shoppingCandidates, enriched);
        if (match?.imageUrl) {
          enriched.imageUrl = match.imageUrl;
          if (match.shoppingOffer) {
            enriched.shoppingOffer = match.shoppingOffer;
          }
          if (!enriched.sources.includes("shopping")) {
            enriched.sources = [...enriched.sources, "shopping"];
          }
          break;
        }
      }
    } catch {
      // Shopping thumbnails are optional; product lookup must not fail when this API is unavailable.
    }
  }

  const recall = await lookupI0490Internal({
    productName: enriched.name,
    brand: enriched.brand,
    barcode: enriched.barcode,
    reportNo: enriched.reportNo,
  });

  if (recall.recall) {
    enriched.recall = recall.recall;
  }

  if (!enriched.sources.includes("public_api")) {
    enriched.sources = [...enriched.sources, "public_api"];
  }

  return enriched;
};
