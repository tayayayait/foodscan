// Internal product type (normalized from various sources)
export type SourceTag =
  | "verified"
  | "public_api"
  | "open_db"
  | "ai_estimated"
  | "user_submitted"
  | "shopping";

export type ProductStatus =
  | "verified"
  | "public_matched"
  | "open_db_matched"
  | "provisional"
  | "needs_review";

export interface Nutrition {
  // per 100g/ml
  energyKcal?: number;
  sugarsG?: number;
  sodiumMg?: number;
  saturatedFatG?: number;
  proteinG?: number;
  fiberG?: number;
  fruitsVegetablesPercent?: number;
  servingSize?: string;
}

export interface RecallInfo {
  reason: string;
  company: string;
  date: string;
  grade?: string;
}

export interface ShoppingOffer {
  minPrice?: number;
  maxPrice?: number;
  priceText?: string;
  mallName?: string;
  link?: string;
  productId?: string;
  productType?: string;
}

export interface Product {
  id: string; // barcode or generated
  barcode?: string;
  reportNo?: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  submittedImageUrls?: {
    product?: string;
    nutrition?: string;
    ingredients?: string;
  };
  quantity?: string;
  ingredientsText?: string;
  ingredients: string[];
  allergens: string[]; // labeled allergens
  additives: string[];
  certifications?: string[];
  nutrition: Nutrition;
  sources: SourceTag[];
  status: ProductStatus;
  confidence: number; // 0-1
  recall?: RecallInfo;
  shoppingOffer?: ShoppingOffer;
  updatedAt: string;
}

export interface AlternativeFitDecision {
  productId: string;
  isSubstitute: boolean;
  fitScore: number;
  substituteGroup: string;
  reason: string;
}

export interface AlternativeFitJudgement {
  baseSubstituteGroup: string;
  decisions: AlternativeFitDecision[];
  warnings: string[];
}

export interface GeminiAlternativeRecommendation {
  productId: string;
  fitScore: number;
  substituteGroup: string;
  reason: string;
}

export interface GeminiAlternativeRecommendations {
  baseSubstituteGroup: string;
  recommendations: GeminiAlternativeRecommendation[];
  warnings: string[];
}

export interface GeminiAlternativeShoppingSearch {
  query: string;
  targetFood: string;
  reason: string;
  nutritionFocus: string[];
}

export interface GeminiAlternativeShoppingPlan {
  baseNutritionBurden: string;
  searches: GeminiAlternativeShoppingSearch[];
  warnings: string[];
}

export interface GeminiAlternativeShoppingRecommendation {
  productId: string;
  fitScore: number;
  reason: string;
  nutritionFocus: string[];
}

export interface GeminiAlternativeShoppingVerification {
  recommendations: GeminiAlternativeShoppingRecommendation[];
  warnings: string[];
}

export interface FoodPairingRecommendation {
  foods: string[];
  reason: string;
  nutritionFocus: string[];
  caution?: string;
  fitScore: number;
}

export interface FoodPairingJudgement {
  overallStrategy: string;
  pairings: FoodPairingRecommendation[];
  warnings: string[];
}

export type Grade = "A" | "B" | "C" | "D" | "E";
export type Severity = "good" | "normal" | "caution" | "danger" | "info";

export type FoodAlertPreference = "gluten" | "lactose" | "sulfites" | "soy" | "palm_oil";
export type DietaryPreference = "vegetarian" | "vegan" | "pork_free";

export interface UserPreferences {
  foodAlerts: FoodAlertPreference[];
  dietaryPreferences: DietaryPreference[];
}
