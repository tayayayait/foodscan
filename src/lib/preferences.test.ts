import { describe, expect, it } from "vitest";
import { buildPreferenceSummary, findFoodAlertMatches, normalizePreferences } from "./preferences";
import type { Product } from "./types";
import type { UserPreferences } from "./types";

describe("user preference helpers", () => {
  it("normalizes Yuka-style food preferences and removes unsupported values", () => {
    const normalized = normalizePreferences({
      foodAlerts: ["gluten", "gluten", "soy", "invalid"],
      dietaryPreferences: ["vegan", "pork_free", "invalid"],
    });

    expect(normalized).toEqual({
      foodAlerts: ["gluten", "soy"],
      dietaryPreferences: ["vegan", "pork_free"],
    });
  });

  it("migrates supported legacy allergen preferences to food alerts", () => {
    expect(
      normalizePreferences({
        preset: "allergy_first",
        allergens: ["밀", "우유", "대두", "아황산류", "계란"],
      }),
    ).toEqual({
      foodAlerts: ["gluten", "lactose", "soy", "sulfites"],
      dietaryPreferences: [],
    });
  });

  it("builds a concise visible profile summary", () => {
    const summary = buildPreferenceSummary({
      foodAlerts: ["gluten", "palm_oil"],
      dietaryPreferences: ["vegan"],
    });

    expect(summary.description).toBe("글루텐, 팜유, 비건");
    expect(summary.badges).toEqual(["성분 알림 2개", "식이 선호 1개"]);
  });

  it("ignores trace-only ingredient notices when matching food alerts", () => {
    const product: Product = {
      id: "trace-only",
      name: "Trace cereal",
      ingredients: ["귀리", "설탕"],
      allergens: [],
      additives: [],
      ingredientsText: "귀리, 설탕. may contain traces of wheat.",
      nutrition: {},
      sources: ["public_api"],
      status: "public_matched",
      confidence: 0.9,
      updatedAt: "2026-05-15T00:00:00.000Z",
    };

    expect(
      findFoodAlertMatches(product, {
        foodAlerts: ["gluten"],
        dietaryPreferences: [],
      }),
    ).toEqual([]);
  });
});
