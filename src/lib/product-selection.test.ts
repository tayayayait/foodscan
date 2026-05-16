import { describe, expect, it } from "vitest";
import type { Product } from "./types";
import {
  applyProductCandidateSelection,
  pickFallbackProductCandidate,
  type ProductSelectionCandidate,
} from "./product-selection";

const product = (overrides: Partial<Product>): Product => ({
  id: overrides.id ?? "p",
  barcode: overrides.barcode,
  reportNo: overrides.reportNo,
  name: overrides.name ?? "Test product",
  brand: overrides.brand,
  category: overrides.category,
  quantity: overrides.quantity,
  ingredientsText: overrides.ingredientsText,
  ingredients: overrides.ingredients ?? [],
  allergens: overrides.allergens ?? [],
  additives: overrides.additives ?? [],
  nutrition: overrides.nutrition ?? {},
  sources: overrides.sources ?? ["open_db"],
  status: overrides.status ?? "open_db_matched",
  confidence: overrides.confidence ?? 0.8,
  updatedAt: overrides.updatedAt ?? "2026-05-13T00:00:00.000Z",
});

describe("product selection", () => {
  it("uses Gemini's selected candidate index when it is valid", () => {
    const candidates: ProductSelectionCandidate[] = [
      { source: "open_food_facts", product: product({ id: "off" }) },
      { source: "public_api", product: product({ id: "public", sources: ["public_api"] }) },
    ];

    expect(
      applyProductCandidateSelection(candidates, {
        selectedIndex: 1,
        confidence: 0.9,
        reason: "official barcode match",
        warnings: [],
      })?.id,
    ).toBe("public");
  });

  it("falls back to the most trusted complete candidate when Gemini selection is invalid", () => {
    const candidates: ProductSelectionCandidate[] = [
      {
        source: "local",
        product: product({
          id: "local-draft",
          status: "provisional",
          sources: ["ai_estimated"],
          confidence: 0.99,
        }),
      },
      {
        source: "public_api",
        product: product({
          id: "official",
          barcode: "8801234567890",
          reportNo: "202600001",
          status: "public_matched",
          sources: ["public_api"],
          confidence: 0.9,
        }),
      },
    ];

    expect(
      applyProductCandidateSelection(candidates, {
        selectedIndex: 8,
        confidence: 0.1,
        reason: "",
        warnings: [],
      })?.id,
    ).toBe("official");
  });

  it("orders same-trust candidates by completeness before confidence", () => {
    const sparse = product({
      id: "sparse",
      status: "open_db_matched",
      sources: ["open_db"],
      confidence: 0.95,
    });
    const complete = product({
      id: "complete",
      barcode: "8801234567890",
      ingredients: ["wheat"],
      nutrition: { sugarsG: 1 },
      status: "open_db_matched",
      sources: ["open_db"],
      confidence: 0.8,
    });

    expect(
      pickFallbackProductCandidate([
        { source: "open_food_facts", product: sparse },
        { source: "open_food_facts", product: complete },
      ])?.product.id,
    ).toBe("complete");
  });

  it("prefers a freshly enriched public candidate over a stale local public cache", () => {
    const cached = product({
      id: "cached",
      barcode: "8801019314056",
      reportNo: "19950144120110",
      status: "public_matched",
      sources: ["public_api"],
      confidence: 0.92,
      nutrition: {},
    });
    const enriched = product({
      id: "enriched",
      barcode: "8801019314056",
      reportNo: "19950144120110",
      status: "public_matched",
      sources: ["public_api"],
      confidence: 0.92,
      nutrition: {
        energyKcal: 450,
        sugarsG: 34.29,
        sodiumMg: 200,
        saturatedFatG: 8.57,
        proteinG: 5.71,
      },
    });

    expect(
      pickFallbackProductCandidate([
        { source: "local", product: cached },
        { source: "public_api", product: enriched },
      ])?.product.id,
    ).toBe("enriched");
  });
});
