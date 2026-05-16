import { describe, expect, it } from "vitest";
import type { Product } from "./types";
import {
  detectAmbiguousCandidates,
  filterAndSortProducts,
  highlightMatchParts,
  type SearchFilters,
} from "./search-utils";

const product = (overrides: Partial<Product>): Product => ({
  id: overrides.id ?? "p",
  name: overrides.name ?? "제품",
  brand: overrides.brand,
  category: overrides.category,
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: overrides.sources ?? ["open_db"],
  status: overrides.status ?? "open_db_matched",
  confidence: overrides.confidence ?? 0.8,
  updatedAt: overrides.updatedAt ?? "2026-05-12T09:00:00.000Z",
});

describe("search utils", () => {
  it("filters by source and category then sorts high score proxy first", () => {
    const filters: SearchFilters = {
      source: "public_api",
      category: "라면",
      sort: "confidence_desc",
    };
    const results = filterAndSortProducts(
      [
        product({ id: "1", category: "라면", sources: ["public_api"], confidence: 0.7 }),
        product({ id: "2", category: "과자", sources: ["public_api"], confidence: 0.99 }),
        product({ id: "3", category: "라면", sources: ["open_db"], confidence: 0.95 }),
        product({ id: "4", category: "라면", sources: ["public_api"], confidence: 0.91 }),
      ],
      filters,
    );

    expect(results.map((item) => item.id)).toEqual(["4", "1"]);
  });

  it("detects ambiguous candidates when confidence gap is below threshold", () => {
    const candidates = detectAmbiguousCandidates([
      product({ id: "1", confidence: 0.84 }),
      product({ id: "2", confidence: 0.76 }),
      product({ id: "3", confidence: 0.4 }),
    ]);

    expect(candidates.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("splits text into highlight parts case-insensitively", () => {
    expect(highlightMatchParts("Apple Juice", "app")).toEqual([
      { text: "App", match: true },
      { text: "le Juice", match: false },
    ]);
  });
});
