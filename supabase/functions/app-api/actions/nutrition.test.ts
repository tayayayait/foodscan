import { describe, expect, it } from "vitest";
import {
  mergeNutrition,
  mergeNutritionPreferIncoming,
  scoreLocalNutritionRow,
} from "./nutrition.ts";
import type { NutritionProductRow } from "../_shared/types.ts";

const nutritionRow = (overrides: Partial<NutritionProductRow>): NutritionProductRow => ({
  food_code: "P101",
  report_no: "19870415003156",
  name: "스윙칩스파이시치폴레맛",
  normalized_name: "스윙칩스파이시치폴레맛",
  manufacturer: "(주)오리온",
  normalized_manufacturer: "주오리온",
  category: "스낵과자",
  large_category: null,
  representative_food: null,
  small_category: null,
  basis_amount: "100g",
  serving_size: "30g",
  food_weight: "60g",
  energy_kcal: 573,
  sugars_g: 3.33,
  sodium_mg: 600,
  saturated_fat_g: 14.33,
  protein_g: 3.33,
  source_name: "local",
  data_basis_date: "2026-04-02",
  ...overrides,
});

describe("nutrition merge helpers", () => {
  it("keeps existing values when filling missing nutrition", () => {
    expect(
      mergeNutrition(
        { energyKcal: 455.6, sugarsG: 0 },
        { energyKcal: 450, sugarsG: 34.29, sodiumMg: 200 },
      ),
    ).toEqual({
      energyKcal: 455.6,
      sugarsG: 0,
      sodiumMg: 200,
      saturatedFatG: undefined,
      proteinG: undefined,
      servingSize: undefined,
    });
  });

  it("prefers enriched public nutrition over OCR placeholders", () => {
    expect(
      mergeNutritionPreferIncoming(
        { energyKcal: 455.6, sugarsG: 0, sodiumMg: 0, saturatedFatG: 0, proteinG: 0 },
        {
          energyKcal: 450,
          sugarsG: 34.29,
          sodiumMg: 200,
          saturatedFatG: 8.57,
          proteinG: 5.71,
          servingSize: "30g",
        },
      ),
    ).toEqual({
      energyKcal: 450,
      sugarsG: 34.29,
      sodiumMg: 200,
      saturatedFatG: 8.57,
      proteinG: 5.71,
      servingSize: "30g",
    });
  });
});

describe("local nutrition row scoring", () => {
  it("uses existing nutrition and flavor text to rank a broad Open Food Facts name", () => {
    const target = {
      productName: "스윙칩",
      brand: "오리온",
      nutrition: {
        energyKcal: 586.67,
        sugarsG: 3.33,
        proteinG: 6.67,
      },
      flavorText: "ROASTED RED PEPPER PASTE TASTE",
    };

    const gochujangScore = scoreLocalNutritionRow(
      nutritionRow({
        report_no: "19870415003244",
        name: "스윙칩볶음고추장맛",
        normalized_name: "스윙칩볶음고추장맛",
        energy_kcal: 587,
        sugars_g: 3.33,
        sodium_mg: 467,
        saturated_fat_g: 14.33,
        protein_g: 6.67,
      }),
      target,
    );
    const chipotleScore = scoreLocalNutritionRow(nutritionRow({}), target);

    expect(gochujangScore).toBeGreaterThan(chipotleScore);
  });
});
