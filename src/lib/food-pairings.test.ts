import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "./types";

const recommendFoodPairings = vi.fn();

vi.mock("./public-api", () => ({
  recommendFoodPairings,
}));

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "base",
  name: "초콜릿 쿠키",
  category: "과자",
  ingredients: ["밀가루", "설탕"],
  allergens: ["밀"],
  additives: [],
  nutrition: {
    energyKcal: 500,
    sugarsG: 36,
    sodiumMg: 400,
    saturatedFatG: 13,
    proteinG: 4,
  },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.92,
  updatedAt: "2026-05-15T00:00:00.000Z",
  ...overrides,
});

describe("food pairing recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the Edge Function when the product has nutrition basis", async () => {
    const judgement = {
      overallStrategy: "단백질과 식이섬유 보완",
      pairings: [
        {
          foods: ["무가당 그릭요거트"],
          reason: "단백질을 보완합니다.",
          nutritionFocus: ["단백질 보완"],
          fitScore: 91,
        },
      ],
      warnings: [],
    };
    recommendFoodPairings.mockResolvedValue(judgement);
    const { getFoodPairingRecommendations } = await import("./food-pairings");

    await expect(getFoodPairingRecommendations(product())).resolves.toBe(judgement);
    expect(recommendFoodPairings).toHaveBeenCalledWith(product());
  });

  it("does not call Gemini when all nutrition fields are missing", async () => {
    const { getFoodPairingRecommendations } = await import("./food-pairings");

    await expect(getFoodPairingRecommendations(product({ nutrition: {} }))).resolves.toEqual({
      overallStrategy: "",
      pairings: [],
      warnings: ["영양성분 정보가 없어 조합 추천을 생성하지 않았습니다."],
    });
    expect(recommendFoodPairings).not.toHaveBeenCalled();
  });
});
