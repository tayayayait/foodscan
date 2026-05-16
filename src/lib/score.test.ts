import { describe, expect, it } from "vitest";
import { computeScore } from "./score";
import type { Product, UserPreferences } from "./types";

const prefs: UserPreferences = { foodAlerts: [], dietaryPreferences: [] };

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "테스트 제품",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {
    energyKcal: 90,
    sugarsG: 2,
    sodiumMg: 120,
    saturatedFatG: 1,
    proteinG: 8,
  },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.92,
  updatedAt: "2026-05-13T00:00:00.000Z",
  ...overrides,
});

describe("food scoring policy", () => {
  it("returns a structured 60/30/10 score breakdown for a computable product", () => {
    const result = computeScore(product(), prefs);

    expect(result.computable).toBe(true);
    expect(result.score).toBe(90);
    expect(result.breakdown).toEqual({
      nutrition: 60,
      additives: 30,
      certification: 0,
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "certification_unknown",
        blocking: false,
      }),
    );
  });

  it("does not compute a numeric score when required nutrition data is insufficient", () => {
    const result = computeScore(
      product({
        nutrition: {
          sugarsG: 2,
          sodiumMg: 120,
        },
      }),
      prefs,
    );

    expect(result.computable).toBe(false);
    expect(result.score).toBeNull();
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "nutrition_insufficient",
        blocking: true,
      }),
    );
  });

  it("keeps recall and user allergy matches as warnings rather than product score deductions", () => {
    const result = computeScore(
      product({
        allergens: ["우유"],
        ingredientsText: "원유, 설탕",
        recall: {
          reason: "회수 대상",
          company: "제조사",
          date: "2026-05-13",
        },
      }),
      { foodAlerts: ["lactose"], dietaryPreferences: [] },
    );

    expect(result.score).toBe(90);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "recall",
        blocking: true,
      }),
    );
    expect(result.personalWarnings).toContainEqual(
      expect.objectContaining({
        code: "food_alert_lactose",
        blocking: true,
      }),
    );
  });

  it("caps total score at 49 when a high-risk additive is present", () => {
    const result = computeScore(
      product({
        additives: ["아질산나트륨"],
        certifications: ["유기농"],
        sources: ["verified"],
        status: "verified",
      }),
      prefs,
    );

    expect(result.computable).toBe(true);
    expect(result.score).toBe(49);
    expect(result.breakdown.additives).toBeLessThan(30);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "high_risk_additive",
        blocking: false,
      }),
    );
  });

  it("hides numeric scores for low-confidence AI or user submitted products", () => {
    const result = computeScore(
      product({
        sources: ["ai_estimated"],
        status: "needs_review",
        confidence: 0.62,
      }),
      prefs,
    );

    expect(result.computable).toBe(false);
    expect(result.score).toBeNull();
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "low_confidence",
        blocking: true,
      }),
    );
  });

  it("adds personal warnings when configured food alerts are detected", () => {
    const result = computeScore(
      product({
        ingredientsText: "밀가루, 팜유, 설탕",
      }),
      {
        foodAlerts: ["gluten", "palm_oil"],
        dietaryPreferences: [],
      },
    );

    expect(result.personalWarnings).toContainEqual(
      expect.objectContaining({
        code: "food_alert_gluten",
        blocking: false,
        severity: "caution",
      }),
    );
    expect(result.personalWarnings).toContainEqual(
      expect.objectContaining({
        code: "food_alert_palm_oil",
      }),
    );
  });

  it("adds personal warnings when selected dietary preferences are incompatible", () => {
    const result = computeScore(
      product({
        ingredientsText: "우유, 계란, 돼지고기",
      }),
      {
        foodAlerts: [],
        dietaryPreferences: ["vegan", "pork_free"],
      },
    );

    expect(result.personalWarnings).toContainEqual(
      expect.objectContaining({
        code: "dietary_preference_vegan",
        severity: "caution",
      }),
    );
    expect(result.personalWarnings).toContainEqual(
      expect.objectContaining({
        code: "dietary_preference_pork_free",
        severity: "caution",
      }),
    );
  });
});
