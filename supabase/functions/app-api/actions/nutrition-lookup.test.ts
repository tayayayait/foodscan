import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NutritionProductRow } from "../_shared/types.ts";

const requestSupabase = vi.fn();

vi.mock("../_shared/supabase-rest.ts", () => ({
  requestSupabase,
}));

const GOLD_MAYONNAISE = "\uace8\ub4dc\ub9c8\uc694\ub124\uc2a4";
const OTTOGI_GOLD_MAYONNAISE = "\uc624\ub69c\uae30\uace8\ub4dc\ub9c8\uc694\ub124\uc2a4";
const OTTOGI = "\uc624\ub69c\uae30";

const goldMayonnaiseRow: NutritionProductRow = {
  food_code: "P113-202020200-0008",
  report_no: "199202550364",
  name: "\uace8\ub4dc \ub9c8\uc694\ub124\uc2a4",
  normalized_name: GOLD_MAYONNAISE,
  manufacturer: "\uc8fc\uc2dd\ud68c\uc0ac \uc624\ub69c\uae30",
  normalized_manufacturer: `\uc8fc${OTTOGI}`,
  category: "\ub9c8\uc694\ub124\uc988",
  large_category: null,
  representative_food: null,
  small_category: null,
  basis_amount: "100g",
  serving_size: "10g",
  food_weight: "50g",
  energy_kcal: 740,
  sugars_g: 1.5,
  sodium_mg: 520,
  saturated_fat_g: 14,
  protein_g: 1.5,
  source_name: "local",
  data_basis_date: "2026-04-02",
};

describe("local nutrition lookup", () => {
  beforeEach(() => {
    requestSupabase.mockReset();
    requestSupabase.mockImplementation(async (_table, init) => {
      const normalizedName = init?.params?.normalized_name;
      return normalizedName === `eq.${GOLD_MAYONNAISE}` ? [goldMayonnaiseRow] : [];
    });
  });

  it("matches a product name that repeats the manufacturer name", async () => {
    const { lookupNutritionLocalInternal } = await import("./nutrition.ts");

    const result = await lookupNutritionLocalInternal(
      OTTOGI_GOLD_MAYONNAISE,
      `(\uc8fc)${OTTOGI}`,
      "20010445055309",
    );

    expect(result?.foodName).toBe(goldMayonnaiseRow.name);
    expect(result?.nutrition.energyKcal).toBe(740);
    expect(requestSupabase).toHaveBeenCalledWith(
      "nutrition_products",
      expect.objectContaining({
        params: expect.objectContaining({ normalized_name: `eq.${GOLD_MAYONNAISE}` }),
      }),
    );
  });
});
