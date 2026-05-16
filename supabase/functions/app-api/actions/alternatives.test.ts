import { describe, expect, it } from "vitest";
import { categorySearchParams, isSameNutritionRow } from "./alternatives.ts";
import type { NutritionProductRow, Product } from "../_shared/types.ts";

const product = (overrides: Partial<Product>): Product => ({
  id: "base",
  name: "Oreo Chocolate Sandwich Cookies",
  brand: "Oreo",
  category: "Snack",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.92,
  updatedAt: "2026-05-14T00:00:00.000Z",
  ...overrides,
});

const nutritionRow = (overrides: Partial<NutritionProductRow>): NutritionProductRow => ({
  food_code: "P101",
  report_no: "19960399065283",
  name: "Oreo Chocolate Sandwich Cookies",
  normalized_name: "oreochocolatesandwichcookies",
  manufacturer: "Oreo",
  normalized_manufacturer: "oreo",
  category: "Bread",
  large_category: null,
  representative_food: null,
  small_category: null,
  basis_amount: "100g",
  serving_size: "30g",
  food_weight: "100g",
  energy_kcal: 500,
  sugars_g: 38,
  sodium_mg: 400,
  saturated_fat_g: 13,
  protein_g: 4,
  source_name: "local",
  data_basis_date: "2026-04-02",
  ...overrides,
});

describe("alternative candidate search params", () => {
  it("prefers the public product category over a conflicting nutrition DB category", () => {
    const params = categorySearchParams(
      product({ category: "Snack" }),
      nutritionRow({ category: "Bread" }),
    );

    expect(params[0]).toEqual({ field: "category", value: "Snack" });
    expect(params).not.toContainEqual({ field: "category", value: "Bread" });
  });

  it("treats same product-line variants as the base product for short Korean names", () => {
    const sameProductLine = nutritionRow({
      food_code: "P-SWING-GOCHUJANG",
      report_no: "19960399065283",
      name: "스윙칩볶음고추장맛",
      normalized_name: "스윙칩볶음고추장맛",
      manufacturer: "(주)오리온",
      normalized_manufacturer: "오리온",
      category: "과자",
    });

    expect(
      isSameNutritionRow(
        sameProductLine,
        product({
          id: "8801117775001",
          barcode: "8801117775001",
          name: "스윙칩",
          brand: "오리온",
          category: "과자",
        }),
      ),
    ).toBe(true);
  });
});
