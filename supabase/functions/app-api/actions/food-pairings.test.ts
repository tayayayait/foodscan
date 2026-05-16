import { describe, expect, it } from "vitest";
import { compactProductForFoodPairing, normalizeFoodPairingJudgement } from "./food-pairings.ts";
import type { Product } from "../_shared/types.ts";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "base",
  name: "초콜릿 크림 쿠키",
  brand: "과자회사",
  category: "과자",
  ingredientsText: "밀가루, 설탕, 팜유, 코코아분말",
  ingredients: ["밀가루", "설탕", "팜유", "코코아분말"],
  allergens: ["밀"],
  additives: ["레시틴"],
  nutrition: {
    energyKcal: 500,
    sugarsG: 36,
    sodiumMg: 400,
    saturatedFatG: 13,
    proteinG: 4,
    servingSize: "100g",
  },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.92,
  updatedAt: "2026-05-15T00:00:00.000Z",
  ...overrides,
});

describe("food pairing judgement", () => {
  it("normalizes Gemini pairings, trims text, filters incomplete entries, and clamps scores", () => {
    const judgement = normalizeFoodPairingJudgement(
      {
        overallStrategy: "당류와 포화지방 부담을 단백질과 식이섬유로 보완",
        pairings: [
          {
            foods: [" 무가당 그릭요거트 ", "블루베리", ""],
            reason: "단백질과 식이섬유를 보완합니다.",
            nutritionFocus: ["단백질 보완", "식이섬유 보완", ""],
            caution: "",
            fitScore: 111,
          },
          {
            foods: ["탄산음료"],
            reason: "",
            nutritionFocus: ["당류 증가"],
            caution: "당류가 높은 제품에는 부적절합니다.",
            fitScore: 50,
          },
          {
            foods: ["삶은 달걀"],
            reason: "단백질을 보완합니다.",
            nutritionFocus: ["단백질 보완"],
            fitScore: "84.6",
          },
          {
            foods: ["채소스틱"],
            reason: "식이섬유와 부피감을 보완합니다.",
            nutritionFocus: ["식이섬유 보완"],
            fitScore: -5,
          },
        ],
        warnings: ["영양 정보 일부만 사용"],
      },
      3,
    );

    expect(judgement).toEqual({
      overallStrategy: "당류와 포화지방 부담을 단백질과 식이섬유로 보완",
      pairings: [
        {
          foods: ["무가당 그릭요거트", "블루베리"],
          reason: "단백질과 식이섬유를 보완합니다.",
          nutritionFocus: ["단백질 보완", "식이섬유 보완"],
          caution: undefined,
          fitScore: 100,
        },
        {
          foods: ["삶은 달걀"],
          reason: "단백질을 보완합니다.",
          nutritionFocus: ["단백질 보완"],
          caution: undefined,
          fitScore: 85,
        },
        {
          foods: ["채소스틱"],
          reason: "식이섬유와 부피감을 보완합니다.",
          nutritionFocus: ["식이섬유 보완"],
          caution: undefined,
          fitScore: 0,
        },
      ],
      warnings: ["영양 정보 일부만 사용"],
    });
  });

  it("compacts product input to nutrition and label fields needed for Gemini", () => {
    expect(compactProductForFoodPairing(product())).toEqual({
      id: "base",
      name: "초콜릿 크림 쿠키",
      brand: "과자회사",
      category: "과자",
      quantity: undefined,
      ingredients: ["밀가루", "설탕", "팜유", "코코아분말"],
      allergens: ["밀"],
      additives: ["레시틴"],
      nutrition: {
        energyKcal: 500,
        sugarsG: 36,
        sodiumMg: 400,
        saturatedFatG: 13,
        proteinG: 4,
        servingSize: "100g",
      },
      sources: ["public_api"],
      status: "public_matched",
      confidence: 0.92,
    });
  });
});
