import { describe, expect, it } from "vitest";
import { buildNutritionBasisRows, parseNutritionAmount } from "./nutrition-display";

describe("nutrition display helpers", () => {
  it("parses serving and package amounts with gram and milliliter units", () => {
    expect(parseNutritionAmount("40g")).toEqual({ value: 40, unit: "g" });
    expect(parseNutritionAmount("총 내용량 1.5 L")).toEqual({ value: 1500, unit: "ml" });
    expect(parseNutritionAmount("2개입")).toBeNull();
  });

  it("builds only the 100g nutrition row from per-100g values", () => {
    const rows = buildNutritionBasisRows({
      sodiumMg: 500,
      sugarsG: 10,
      proteinG: 8,
      servingSize: "40g",
    });

    expect(rows.map((row) => row.key)).toEqual(["per100"]);
    expect(rows[0].values.sodiumMg).toBe(500);
    expect(rows[0].values.sugarsG).toBe(10);
    expect(rows[0].values.proteinG).toBe(8);
  });
});
