import { recommendFoodPairings } from "./public-api";
import type { FoodPairingJudgement, Nutrition, Product } from "./types";

const NUTRITION_BASIS_KEYS: Array<keyof Nutrition> = [
  "energyKcal",
  "sugarsG",
  "sodiumMg",
  "saturatedFatG",
  "proteinG",
  "fiberG",
];

export const EMPTY_FOOD_PAIRING_JUDGEMENT: FoodPairingJudgement = {
  overallStrategy: "",
  pairings: [],
  warnings: ["영양성분 정보가 없어 조합 추천을 생성하지 않았습니다."],
};

export function hasFoodPairingNutritionBasis(product: Product) {
  return NUTRITION_BASIS_KEYS.some((key) => product.nutrition[key] !== undefined);
}

export async function getFoodPairingRecommendations(
  product: Product,
): Promise<FoodPairingJudgement> {
  if (!hasFoodPairingNutritionBasis(product)) {
    return EMPTY_FOOD_PAIRING_JUDGEMENT;
  }

  return recommendFoodPairings(product);
}
