import { describe, expect, it } from "vitest";
import {
  filterProductsByAlternativeFit,
  normalizeAlternativeFitJudgement,
} from "./alternative-fit.ts";
import type { Product } from "../_shared/types.ts";

const product = (overrides: Partial<Product>): Product => ({
  id: "base",
  name: "Base",
  category: "processed food",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.9,
  updatedAt: "2026-05-14T00:00:00.000Z",
  ...overrides,
});

describe("alternative fit judgement", () => {
  it("normalizes Gemini fit decisions to known product ids and clamps fit scores", () => {
    const judgement = normalizeAlternativeFitJudgement(
      {
        baseSubstituteGroup: "canned ham/luncheon meat",
        decisions: [
          {
            productId: "jokbal",
            isSubstitute: false,
            fitScore: -10,
            substituteGroup: "cooked pork trotter",
            reason: "different use case",
          },
          {
            productId: "luncheon",
            isSubstitute: true,
            fitScore: 120,
            substituteGroup: "canned ham/luncheon meat",
            reason: "same use case",
          },
          {
            productId: "unknown",
            isSubstitute: true,
            fitScore: 100,
            substituteGroup: "unknown",
            reason: "not supplied",
          },
        ],
        warnings: ["broad category was noisy"],
      },
      ["jokbal", "luncheon"],
    );

    expect(judgement).toEqual({
      baseSubstituteGroup: "canned ham/luncheon meat",
      decisions: [
        {
          productId: "jokbal",
          isSubstitute: false,
          fitScore: 0,
          substituteGroup: "cooked pork trotter",
          reason: "different use case",
        },
        {
          productId: "luncheon",
          isSubstitute: true,
          fitScore: 100,
          substituteGroup: "canned ham/luncheon meat",
          reason: "same use case",
        },
      ],
      warnings: ["broad category was noisy"],
    });
  });

  it("keeps only candidates that Gemini marks as sufficiently substitutable", () => {
    const jokbal = product({ id: "jokbal", name: "Black Garlic Pork Trotter" });
    const luncheon = product({ id: "luncheon", name: "Low Sodium Luncheon Meat" });

    const filtered = filterProductsByAlternativeFit([jokbal, luncheon], {
      baseSubstituteGroup: "canned ham/luncheon meat",
      decisions: [
        {
          productId: "jokbal",
          isSubstitute: false,
          fitScore: 12,
          substituteGroup: "cooked pork trotter",
          reason: "different dish",
        },
        {
          productId: "luncheon",
          isSubstitute: true,
          fitScore: 86,
          substituteGroup: "canned ham/luncheon meat",
          reason: "same use case",
        },
      ],
      warnings: [],
    });

    expect(filtered.map((item) => item.id)).toEqual(["luncheon"]);
  });
});
