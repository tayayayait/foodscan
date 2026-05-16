import { describe, expect, it } from "vitest";
import { buildHistoryInsights, filterAttentionProducts } from "./history-insights";
import type { Product, UserPreferences } from "./types";

const prefs: UserPreferences = {
  foodAlerts: ["lactose"],
  dietaryPreferences: [],
};

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "기본 제품",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {
    energyKcal: 90,
    sugarsG: 2,
    sodiumMg: 120,
    saturatedFatG: 1,
  },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.92,
  updatedAt: "2026-05-13T00:00:00.000Z",
  ...overrides,
});

describe("history insights", () => {
  it("summarizes scored products, review-needed products, and average score", () => {
    const insights = buildHistoryInsights(
      [
        product({ id: "safe", name: "안전 제품" }),
        product({
          id: "sugar",
          name: "고당 제품",
          nutrition: { energyKcal: 260, sugarsG: 30, sodiumMg: 400, saturatedFatG: 2 },
        }),
        product({
          id: "review",
          name: "검수 필요",
          sources: ["ai_estimated"],
          status: "needs_review",
          confidence: 0.55,
        }),
      ],
      prefs,
    );

    expect(insights.totalCount).toBe(3);
    expect(insights.scoredCount).toBe(2);
    expect(insights.reviewNeededCount).toBe(1);
    expect(insights.averageScore).toBe(79);
    expect(insights.gradeCounts).toEqual({ A: 1, B: 0, C: 1, D: 0, E: 0 });
  });

  it("finds the most frequent concern across nutrition, additives, recall, and personal warnings", () => {
    const insights = buildHistoryInsights(
      [
        product({
          id: "sugar-a",
          allergens: ["우유"],
          nutrition: { energyKcal: 260, sugarsG: 30, sodiumMg: 400, saturatedFatG: 2 },
        }),
        product({
          id: "sugar-b",
          allergens: ["우유"],
          nutrition: { energyKcal: 280, sugarsG: 22, sodiumMg: 300, saturatedFatG: 2 },
        }),
        product({
          id: "additive",
          additives: ["E171"],
        }),
        product({
          id: "recall",
          recall: { reason: "회수", company: "제조사", date: "2026-05-13" },
        }),
      ],
      prefs,
    );

    expect(insights.concerns.sugar).toBe(2);
    expect(insights.concerns.highRiskAdditive).toBe(1);
    expect(insights.concerns.recall).toBe(1);
    expect(insights.concerns.personalWarning).toBe(2);
    expect(insights.topConcern).toEqual(
      expect.objectContaining({
        key: "sugar",
        count: 2,
        label: "당류 과다",
      }),
    );
  });

  it("returns attention products that need follow-up", () => {
    const safe = product({ id: "safe", name: "안전 제품" });
    const recall = product({
      id: "recall",
      name: "회수 제품",
      recall: { reason: "회수", company: "제조사", date: "2026-05-13" },
    });
    const review = product({
      id: "review",
      name: "검수 필요",
      sources: ["ai_estimated"],
      status: "needs_review",
      confidence: 0.55,
    });

    const result = filterAttentionProducts([safe, recall, review], prefs);

    expect(result.map((item) => item.product.id)).toEqual(["recall", "review"]);
    expect(result[0].reasons).toContain("회수 이력");
    expect(result[1].reasons).toContain("검수 필요");
  });
});
