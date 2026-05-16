import { callAppEdgeFunction } from "./edge-function-client";
import type {
  AlternativeFitJudgement,
  FoodPairingJudgement,
  GeminiAlternativeShoppingPlan,
  GeminiAlternativeShoppingSearch,
  GeminiAlternativeShoppingVerification,
  GeminiAlternativeRecommendations,
  Nutrition,
  Product,
  RecallInfo,
} from "./types";

export interface RecallLookupResult {
  recall: RecallInfo | null;
  error: boolean;
  message?: string;
}

export interface NutritionLookupResult {
  nutrition: Nutrition;
  matched: boolean;
  foodName?: string;
  manufacturer?: string;
  source: "local_nutrition_db" | "public_nutrition";
}

export interface IngredientInfo {
  name: string;
  code?: string;
  largeClass?: string;
  middleClass?: string;
  alias?: string;
  englishName?: string;
  scientificName?: string;
  partName?: string;
  condition?: string;
  usable?: boolean;
  source: "public_data" | "food_safety_code";
}

export interface AdditiveInfo {
  name: string;
  code?: string;
  category?: string;
  standards: Array<{
    testItem?: string;
    detail?: string;
    standardValue?: string;
    summary?: string;
    unit?: string;
    harmful?: boolean;
  }>;
  source: "food_safety_additive" | "ingredient_info";
}

export const lookupC005 = (barcode: string) =>
  callAppEdgeFunction<Product | null>("lookupC005", { barcode });

export const lookupI2570 = (barcode: string) =>
  callAppEdgeFunction<Product | null>("lookupI2570", { barcode });

export const lookupC002 = (reportNo: string) =>
  callAppEdgeFunction<{ ingredientsText: string; ingredients: string[] }>("lookupC002", {
    reportNo,
  });

export const searchI1250 = (query: string) =>
  callAppEdgeFunction<Product[]>("searchI1250", { query });

export const lookupNutritionStandard = (productName: string, brand?: string, reportNo?: string) =>
  callAppEdgeFunction<NutritionLookupResult | null>("lookupNutritionStandard", {
    productName,
    brand,
    reportNo,
  });

export const lookupIngredientInfo = (ingredientName: string) =>
  callAppEdgeFunction<IngredientInfo | null>("lookupIngredientInfo", { ingredientName });

export const lookupAdditiveInfo = (additiveName: string) =>
  callAppEdgeFunction<AdditiveInfo | null>("lookupAdditiveInfo", { additiveName });

export const searchNaverShopping = (query: string) =>
  callAppEdgeFunction<Product[]>("searchNaverShopping", { query });

export const searchAlternativeCandidates = (product: Product, limit = 20) =>
  callAppEdgeFunction<Product[]>("searchAlternativeCandidates", { product, limit });

export const judgeAlternativeFit = (product: Product, candidates: Product[]) =>
  callAppEdgeFunction<AlternativeFitJudgement>("judgeAlternativeFit", { product, candidates });

export const recommendAlternativeProducts = (product: Product, candidates: Product[]) =>
  callAppEdgeFunction<GeminiAlternativeRecommendations>("recommendAlternativeProducts", {
    product,
    candidates,
  });

export const recommendAlternativeShoppingSearches = (product: Product) =>
  callAppEdgeFunction<GeminiAlternativeShoppingPlan>("recommendAlternativeShoppingSearches", {
    product,
  });

export const verifyAlternativeShoppingResults = (
  product: Product,
  search: GeminiAlternativeShoppingSearch,
  candidates: Product[],
) =>
  callAppEdgeFunction<GeminiAlternativeShoppingVerification>("verifyAlternativeShoppingResults", {
    product,
    search,
    candidates,
  });

export const recommendFoodPairings = (product: Product) =>
  callAppEdgeFunction<FoodPairingJudgement>("recommendFoodPairings", { product });

export const searchOpenFoodFacts = (query: string) =>
  callAppEdgeFunction<Product[]>("searchOpenFoodFacts", { query });

export const lookupOpenFoodFactsByBarcode = (barcode: string) =>
  callAppEdgeFunction<Product | null>("lookupOpenFoodFactsByBarcode", { barcode });

export const lookupI0490 = (
  productName: string,
  brand?: string,
  barcode?: string,
  reportNo?: string,
) =>
  callAppEdgeFunction<RecallLookupResult>("lookupI0490", {
    productName,
    brand,
    barcode,
    reportNo,
  });

export const enrichProduct = (product: Product) =>
  callAppEdgeFunction<Product>("enrichProduct", { product });
