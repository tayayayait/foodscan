import { describe, expect, it } from "vitest";
import { buildSafetyWatch } from "./safety-watch";
import type { Product, UserPreferences } from "./types";

const prefs: UserPreferences = { foodAlerts: ["lactose"], dietaryPreferences: [] };

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  barcode: "8800000000001",
  name: "테스트 제품",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {
    energyKcal: 100,
    sugarsG: 3,
    sodiumMg: 120,
    saturatedFatG: 1,
  },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.92,
  updatedAt: "2026-05-13T00:00:00.000Z",
  ...overrides,
});

describe("safety watch", () => {
  it("deduplicates products across recent and saved lists while preserving source labels", () => {
    const recent = product({
      id: "recent-copy",
      name: "최근 제품",
      recall: {
        reason: "회수 대상",
        company: "제조사",
        date: "2026-05-13",
      },
    });
    const saved = product({
      id: "saved-copy",
      name: "저장 제품",
      recall: {
        reason: "회수 대상",
        company: "제조사",
        date: "2026-05-13",
      },
    });

    const watch = buildSafetyWatch({ recent: [recent], saved: [saved], provisional: [], prefs });

    expect(watch.items).toHaveLength(1);
    expect(watch.items[0]).toEqual(
      expect.objectContaining({
        product: expect.objectContaining({ barcode: "8800000000001" }),
        severity: "danger",
        sourceLabels: ["저장", "최근"],
      }),
    );
    expect(watch.items[0].reasons).toContainEqual(
      expect.objectContaining({ key: "recall", label: "회수·판매중지" }),
    );
    expect(watch.summary).toEqual(
      expect.objectContaining({
        totalWatched: 1,
        flaggedCount: 1,
        dangerCount: 1,
        recallCount: 1,
        savedFlaggedCount: 1,
      }),
    );
  });

  it("prioritizes recall, direct food alerts, and high-risk additive issues before lower confidence issues", () => {
    const recallProduct = product({
      id: "recall",
      barcode: "8800000000002",
      name: "회수 제품",
      recall: { reason: "판매중지", company: "제조사", date: "2026-05-13" },
    });
    const foodAlertProduct = product({
      id: "food-alert",
      barcode: "8800000000003",
      name: "성분 알림 제품",
      allergens: ["우유"],
    });
    const additiveProduct = product({
      id: "additive",
      barcode: "8800000000004",
      name: "첨가물 제품",
      additives: ["아질산나트륨"],
      sources: ["verified"],
      status: "verified",
    });
    const lowConfidenceProduct = product({
      id: "low",
      barcode: "8800000000005",
      name: "저신뢰 제품",
      sources: ["ai_estimated"],
      status: "needs_review",
      confidence: 0.51,
    });

    const watch = buildSafetyWatch({
      recent: [lowConfidenceProduct, additiveProduct, foodAlertProduct, recallProduct],
      saved: [],
      provisional: [],
      prefs,
    });

    expect(watch.items.map((item) => item.product.name)).toEqual([
      "회수 제품",
      "성분 알림 제품",
      "첨가물 제품",
      "저신뢰 제품",
    ]);
    expect(watch.items[1].reasons).toContainEqual(
      expect.objectContaining({ key: "food_alert_direct" }),
    );
    expect(watch.items[2].reasons).toContainEqual(
      expect.objectContaining({ key: "high_risk_additive" }),
    );
    expect(watch.summary).toEqual(
      expect.objectContaining({
        flaggedCount: 4,
        dangerCount: 3,
        cautionCount: 1,
      }),
    );
  });

  it("returns an empty flagged list when watched products have no safety issues", () => {
    const watch = buildSafetyWatch({
      recent: [product({ id: "safe", barcode: "8800000000006" })],
      saved: [],
      provisional: [],
      prefs: { foodAlerts: [], dietaryPreferences: [] },
    });

    expect(watch.items).toEqual([]);
    expect(watch.summary).toEqual({
      totalWatched: 1,
      flaggedCount: 0,
      dangerCount: 0,
      cautionCount: 0,
      infoCount: 0,
      recallCount: 0,
      savedFlaggedCount: 0,
    });
  });
});
