import { afterEach, describe, expect, it, vi } from "vitest";
import {
  filterProductsByGeminiRecommendations,
  normalizeGeminiAlternativeShoppingPlan,
  normalizeGeminiAlternativeShoppingVerification,
  normalizeGeminiAlternativeRecommendations,
  recommendAlternativeProductsInternal,
  recommendAlternativeShoppingSearchesInternal,
  verifyAlternativeShoppingResultsInternal,
} from "./alternative-recommendations.ts";
import {
  alternativeRecommendationPrompt,
  alternativeShoppingSearchPrompt,
  alternativeShoppingVerificationPrompt,
} from "../_shared/runtime.ts";
import type { Product } from "../_shared/types.ts";

const product = (overrides: Partial<Product>): Product => ({
  id: "base",
  name: "Base",
  category: "snack",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.9,
  updatedAt: "2026-05-15T00:00:00.000Z",
  ...overrides,
});

const stubGeminiResponse = (status: number) => {
  vi.stubGlobal("Deno", {
    env: {
      toObject: () => ({
        GEMINI_API_KEY: "test-key",
        GEMINI_OCR_MODEL: "gemini-test-model",
      }),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: "Gemini overloaded" } }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
};

describe("Gemini alternative recommendations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes ordered recommendations to known product ids and clamps fit scores", () => {
    const judgement = normalizeGeminiAlternativeRecommendations(
      {
        baseSubstituteGroup: "sandwich cookie",
        recommendations: [
          {
            productId: "low-sugar-cookie",
            fitScore: 120,
            substituteGroup: "sandwich cookie",
            reason: "쿠키 형태와 섭취 맥락이 유사합니다",
          },
          {
            productId: "unknown",
            fitScore: 99,
            substituteGroup: "unknown",
            reason: "not supplied",
          },
          {
            productId: "low-sugar-cookie",
            fitScore: 80,
            substituteGroup: "duplicate",
            reason: "duplicate",
          },
          {
            productId: "thin-cookie",
            fitScore: -10,
            substituteGroup: "cookie",
            reason: "점수가 낮습니다",
          },
        ],
        warnings: ["후보군이 제한적입니다"],
      },
      ["low-sugar-cookie", "thin-cookie"],
    );

    expect(judgement).toEqual({
      baseSubstituteGroup: "sandwich cookie",
      recommendations: [
        {
          productId: "low-sugar-cookie",
          fitScore: 100,
          substituteGroup: "sandwich cookie",
          reason: "쿠키 형태와 섭취 맥락이 유사합니다",
        },
        {
          productId: "thin-cookie",
          fitScore: 0,
          substituteGroup: "cookie",
          reason: "점수가 낮습니다",
        },
      ],
      warnings: ["후보군이 제한적입니다"],
    });
  });

  it("filters products by Gemini recommendation order and minimum fit score", () => {
    const lowSugarCookie = product({ id: "low-sugar-cookie", name: "저당 쿠키" });
    const thinCookie = product({ id: "thin-cookie", name: "얇은 쿠키" });

    const filtered = filterProductsByGeminiRecommendations([thinCookie, lowSugarCookie], {
      baseSubstituteGroup: "sandwich cookie",
      recommendations: [
        {
          productId: "low-sugar-cookie",
          fitScore: 92,
          substituteGroup: "sandwich cookie",
          reason: "가장 유사합니다",
        },
        {
          productId: "thin-cookie",
          fitScore: 60,
          substituteGroup: "cookie",
          reason: "대체 적합도가 낮습니다",
        },
      ],
      warnings: [],
    });

    expect(filtered.map((item) => item.id)).toEqual(["low-sugar-cookie"]);
  });

  it("normalizes Gemini nutrition shopping search plans", () => {
    const plan = normalizeGeminiAlternativeShoppingPlan({
      baseNutritionBurden: "당류와 포화지방 부담",
      searches: [
        {
          query: " 저당 통밀 쿠키 ",
          targetFood: "통밀 쿠키",
          reason: "당류를 낮춘 간식 대체안입니다.",
          nutritionFocus: ["당류 감소", "포화지방 감소"],
        },
        {
          query: "저당 통밀 쿠키",
          targetFood: "duplicate",
          reason: "duplicate",
          nutritionFocus: ["duplicate"],
        },
        {
          query: "",
          targetFood: "empty",
          reason: "empty",
          nutritionFocus: [],
        },
      ],
      warnings: ["가격 정보는 네이버쇼핑 기준"],
    });

    expect(plan).toEqual({
      baseNutritionBurden: "당류와 포화지방 부담",
      searches: [
        {
          query: "저당 통밀 쿠키",
          targetFood: "통밀 쿠키",
          reason: "당류를 낮춘 간식 대체안입니다.",
          nutritionFocus: ["당류 감소", "포화지방 감소"],
        },
      ],
      warnings: ["가격 정보는 네이버쇼핑 기준"],
    });
  });

  it("keeps candidate ranking generic and adds a separate Gemini shopping search prompt", () => {
    expect(alternativeRecommendationPrompt).toContain(
      "Do not recommend a candidate only because it is healthier",
    );
    expect(alternativeRecommendationPrompt).not.toContain("sandwich cookies");
    expect(alternativeShoppingSearchPrompt).toContain("Naver Shopping search queries");
    expect(alternativeShoppingSearchPrompt).toContain("nutrition burden");
    expect(alternativeShoppingSearchPrompt).toContain("Do not invent specific product facts");
  });

  it("normalizes Gemini shopping result verification to known product ids", () => {
    const verification = normalizeGeminiAlternativeShoppingVerification(
      {
        recommendations: [
          {
            productId: "naver-good",
            fitScore: 120,
            reason: "영양 대체 의도와 맞습니다.",
            nutritionFocus: ["당류 감소", "포화지방 감소"],
          },
          {
            productId: "unknown",
            fitScore: 90,
            reason: "not supplied",
            nutritionFocus: [],
          },
          {
            productId: "naver-good",
            fitScore: 80,
            reason: "duplicate",
            nutritionFocus: ["duplicate"],
          },
          {
            productId: "naver-low",
            fitScore: -10,
            reason: "부적합",
            nutritionFocus: ["부적합"],
          },
        ],
        warnings: ["쇼핑 결과명 기준 판정"],
      },
      ["naver-good", "naver-low"],
    );

    expect(verification).toEqual({
      recommendations: [
        {
          productId: "naver-good",
          fitScore: 100,
          reason: "영양 대체 의도와 맞습니다.",
          nutritionFocus: ["당류 감소", "포화지방 감소"],
        },
        {
          productId: "naver-low",
          fitScore: 0,
          reason: "부적합",
          nutritionFocus: ["부적합"],
        },
      ],
      warnings: ["쇼핑 결과명 기준 판정"],
    });
  });

  it("defines a Gemini prompt for verifying Naver Shopping results", () => {
    expect(alternativeShoppingVerificationPrompt).toContain("Naver Shopping result");
    expect(alternativeShoppingVerificationPrompt).toContain("Reject the original product");
    expect(alternativeShoppingVerificationPrompt).toContain("Do not assume nutrition facts");
  });

  it("returns an empty candidate judgement instead of propagating transient Gemini 503", async () => {
    stubGeminiResponse(503);

    await expect(
      recommendAlternativeProductsInternal(product(), [product({ id: "candidate" })]),
    ).resolves.toEqual({
      baseSubstituteGroup: "",
      recommendations: [],
      warnings: ["Gemini alternative recommendation temporarily unavailable."],
    });
  });

  it("returns an empty shopping search plan instead of propagating transient Gemini 503", async () => {
    stubGeminiResponse(503);

    await expect(recommendAlternativeShoppingSearchesInternal(product())).resolves.toEqual({
      baseNutritionBurden: "",
      searches: [],
      warnings: ["Gemini alternative shopping search temporarily unavailable."],
    });
  });

  it("returns an empty shopping verification instead of propagating transient Gemini 503", async () => {
    stubGeminiResponse(503);

    await expect(
      verifyAlternativeShoppingResultsInternal(
        product(),
        {
          query: "저당 쿠키",
          targetFood: "저당 쿠키",
          reason: "당류 부담 감소",
          nutritionFocus: ["당류 감소"],
        },
        [product({ id: "naver-cookie", sources: ["shopping"] })],
      ),
    ).resolves.toEqual({
      recommendations: [],
      warnings: ["Gemini alternative shopping verification temporarily unavailable."],
    });
  });
});
