import { describe, expect, it } from "vitest";
import { removeUnreadableZeroNutrition } from "./ocr.ts";

describe("OCR nutrition cleanup", () => {
  it("removes zero nutrition placeholders when OCR warns values are unreadable", () => {
    const result = removeUnreadableZeroNutrition({
      productName: "계란과자",
      brand: "해태",
      quantity: "45g",
      category: "과자",
      barcode: "",
      ingredientsText: "",
      ingredients: [],
      allergens: [],
      additives: [],
      nutrition: {
        energyKcal: 455.56,
        sugarsG: 0,
        sodiumMg: 0,
        saturatedFatG: 0,
        proteinG: 0,
        servingSize: "45g",
      },
      confidence: 0.7,
      warnings: [
        "나트륨, 당류, 포화지방, 단백질 정보는 이미지에서 판독 불가하여 0으로 표기되었습니다.",
      ],
    });

    expect(result.nutrition).toEqual({
      energyKcal: 455.56,
      sugarsG: undefined,
      sodiumMg: undefined,
      saturatedFatG: undefined,
      proteinG: undefined,
      servingSize: "45g",
    });
  });

  it("keeps visible zero values when OCR has no unreadable warning", () => {
    const result = removeUnreadableZeroNutrition({
      productName: "무가당 제품",
      brand: "",
      quantity: "",
      category: "",
      barcode: "",
      ingredientsText: "",
      ingredients: [],
      allergens: [],
      additives: [],
      nutrition: { sugarsG: 0, sodiumMg: 0 },
      confidence: 0.8,
      warnings: [],
    });

    expect(result.nutrition.sugarsG).toBe(0);
    expect(result.nutrition.sodiumMg).toBe(0);
  });
});
