import { describe, expect, it } from "vitest";
import { buildProductVerdict } from "./product-verdict";
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

describe("product verdict summary", () => {
  it("formats a computable score into a fast product verdict", () => {
    const p = product({ status: "verified", sources: ["verified"], certifications: ["유기농"] });
    const verdict = buildProductVerdict(p, computeScore(p, prefs));

    expect(verdict.scoreText).toBe("100");
    expect(verdict.scoreSubtext).toBe("A · 매우 좋음");
    expect(verdict.verdictText).toBe("전반적으로 부담이 매우 낮은 제품입니다");
    expect(verdict.tone).toBe("good");
    expect(verdict.trustLabel).toBe("검수 완료");
    expect(verdict.trustSeverity).toBe("good");
    expect(verdict.confidenceLabel).toBe("신뢰도 92%");
  });

  it("prioritizes recall and personal food alert warnings before nutrition reasons", () => {
    const p = product({
      allergens: ["우유"],
      ingredientsText: "원유, 설탕",
      nutrition: {
        energyKcal: 420,
        sugarsG: 40,
        sodiumMg: 1200,
        saturatedFatG: 9,
      },
      recall: {
        reason: "회수 대상",
        company: "제조사",
        date: "2026-05-13",
      },
    });
    const verdict = buildProductVerdict(
      p,
      computeScore(p, { foodAlerts: ["lactose"], dietaryPreferences: [] }),
    );

    expect(verdict.topFindings.map((finding) => finding.title).slice(0, 2)).toEqual([
      "회수·판매중지",
      "성분 알림",
    ]);
  });

  it("shows review-needed text instead of a numeric score for low-confidence temporary data", () => {
    const p = product({ sources: ["ai_estimated"], status: "needs_review", confidence: 0.62 });
    const verdict = buildProductVerdict(p, computeScore(p, prefs));

    expect(verdict.scoreText).toBe("검수 필요");
    expect(verdict.scoreSubtext).toBe("임시 정보");
    expect(verdict.trustLabel).toBe("검수 필요");
    expect(verdict.trustSeverity).toBe("caution");
    expect(verdict.confidenceLabel).toBe("신뢰도 62%");
  });
});
