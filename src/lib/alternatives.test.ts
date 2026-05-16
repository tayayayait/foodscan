import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAlternativeRecommendations,
  dedupeAlternativeCandidates,
  getAlternativeRecommendations,
  rankAlternativeProducts,
} from "./alternatives";
import type { Product } from "./types";

const mocks = vi.hoisted(() => ({
  searchAlternativeCandidates: vi.fn(),
  recommendAlternativeProducts: vi.fn(),
  recommendAlternativeShoppingSearches: vi.fn(),
  verifyAlternativeShoppingResults: vi.fn(),
  searchNaverShopping: vi.fn(),
  searchOpenFoodFacts: vi.fn(),
  searchByName: vi.fn(),
}));

vi.mock("./public-api", () => ({
  searchAlternativeCandidates: mocks.searchAlternativeCandidates,
  recommendAlternativeProducts: mocks.recommendAlternativeProducts,
  recommendAlternativeShoppingSearches: mocks.recommendAlternativeShoppingSearches,
  verifyAlternativeShoppingResults: mocks.verifyAlternativeShoppingResults,
  searchNaverShopping: mocks.searchNaverShopping,
  searchOpenFoodFacts: mocks.searchOpenFoodFacts,
}));

vi.mock("./off", () => ({
  searchByName: mocks.searchByName,
}));

const product = (overrides: Partial<Product>): Product => ({
  id: "base",
  name: "Base snack",
  brand: "Brand",
  category: "snack",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: { energyKcal: 120, sodiumMg: 200, sugarsG: 5, saturatedFatG: 1 },
  sources: ["open_db"],
  status: "open_db_matched",
  confidence: 0.8,
  updatedAt: "2026-05-12T00:00:00.000Z",
  ...overrides,
});

describe("alternative product helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recommendAlternativeProducts.mockImplementation(
      async (_base: Product, candidates: Product[]) => ({
        baseSubstituteGroup: "same food group",
        recommendations: candidates.map((candidate) => ({
          productId: candidate.id,
          fitScore: 90,
          substituteGroup: candidate.category ?? "",
          reason: "같은 사용 맥락의 대체 후보입니다",
        })),
        warnings: [],
      }),
    );
    mocks.recommendAlternativeShoppingSearches.mockResolvedValue({
      baseNutritionBurden: "",
      searches: [],
      warnings: [],
    });
    mocks.verifyAlternativeShoppingResults.mockResolvedValue({
      recommendations: [],
      warnings: [],
    });
    mocks.searchOpenFoodFacts.mockResolvedValue([]);
    mocks.searchByName.mockResolvedValue([]);
  });

  it("excludes the current product and prefers same-category high scoring candidates", () => {
    const base = product({ id: "base", barcode: "111", category: "snack" });
    const ranked = rankAlternativeProducts(base, [
      product({ id: "base", barcode: "111", name: "same" }),
      product({
        id: "worse",
        name: "worse",
        category: "snack",
        nutrition: { energyKcal: 420, sodiumMg: 1200, sugarsG: 40, saturatedFatG: 9 },
      }),
      product({ id: "other-category", name: "other", category: "drink", confidence: 0.99 }),
      product({
        id: "better",
        name: "better",
        category: "snack",
        nutrition: { energyKcal: 90, sodiumMg: 80, sugarsG: 1, saturatedFatG: 0.5 },
        confidence: 0.7,
      }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["better", "worse"]);
  });

  it("falls back to all candidates when no same-category result exists", () => {
    const ranked = rankAlternativeProducts(product({ id: "base", category: "snack" }), [
      product({
        id: "drink",
        name: "light drink",
        category: "drink",
        nutrition: { energyKcal: 50, sodiumMg: 10, sugarsG: 0, saturatedFatG: 0 },
      }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["drink"]);
  });

  it("deduplicates candidates by barcode and normalized name/brand", () => {
    const candidates = dedupeAlternativeCandidates([
      product({ id: "a", barcode: "8801", name: "Better Snack", brand: "A" }),
      product({ id: "b", barcode: "8801", name: "Better Snack duplicate", brand: "A" }),
      product({ id: "c", name: "Better Snack", brand: "A" }),
      product({ id: "d", name: "Other Snack", brand: "A" }),
    ]);

    expect(candidates.map((item) => item.id)).toEqual(["a", "d"]);
  });

  it("builds recommendations only when candidates improve the base score", () => {
    const base = product({
      id: "base",
      barcode: "111",
      category: "snack",
      additives: ["E171"],
      certifications: ["유기농"],
      sources: ["verified"],
      status: "verified",
    });

    const recommendations = buildAlternativeRecommendations(base, [
      product({ id: "same", barcode: "111", name: "same" }),
      product({
        id: "recalled",
        name: "recalled",
        category: "snack",
        recall: { reason: "recall", company: "maker", date: "2026-05-13" },
      }),
      product({ id: "unknown", name: "unknown", category: "snack", nutrition: {} }),
      product({
        id: "worse",
        name: "worse",
        category: "snack",
        nutrition: { energyKcal: 430, sodiumMg: 1200, sugarsG: 40, saturatedFatG: 9 },
      }),
      product({
        id: "better",
        name: "better",
        category: "snack",
        nutrition: { energyKcal: 80, sodiumMg: 80, sugarsG: 1, saturatedFatG: 0.5 },
        additives: [],
        confidence: 0.82,
      }),
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].product.id).toBe("better");
    expect(recommendations[0].kind).toBe("scored");
    expect(recommendations[0].scoreDelta).toBeGreaterThanOrEqual(5);
    expect(recommendations[0].reasons).toContain("점수 개선");
    expect(recommendations[0].reasons).toContain("첨가물 부담 감소");
  });

  it("excludes same product-line variants when the base Korean product name is short", () => {
    const base = product({
      id: "swing-chip-base",
      barcode: "8801117775001",
      name: "스윙칩",
      brand: "오리온",
      category: "과자",
      nutrition: { energyKcal: 480, sodiumMg: 520, sugarsG: 4, saturatedFatG: 9 },
      sources: ["public_api"],
      status: "public_matched",
    });

    const sameProductLine = product({
      id: "swing-chip-gochujang",
      name: "스윙칩볶음고추장맛",
      brand: "(주)오리온",
      category: "과자",
      nutrition: { energyKcal: 360, sodiumMg: 320, sugarsG: 2, saturatedFatG: 3 },
      sources: ["public_api"],
      status: "public_matched",
      confidence: 0.95,
    });

    const trueAlternative = product({
      id: "potato-chip-alternative",
      name: "포카칩 오리지널",
      brand: "오리온",
      category: "과자",
      nutrition: { energyKcal: 320, sodiumMg: 180, sugarsG: 1, saturatedFatG: 2 },
      sources: ["public_api"],
      status: "public_matched",
      confidence: 0.9,
    });

    const recommendations = buildAlternativeRecommendations(base, [
      sameProductLine,
      trueAlternative,
    ]);

    expect(recommendations.map((item) => item.product.id)).toEqual(["potato-chip-alternative"]);
  });

  it("filters recommendations that conflict with configured food preferences", () => {
    const base = product({
      id: "base",
      name: "기본 시리얼",
      category: "시리얼",
      nutrition: {
        energyKcal: 420,
        sugarsG: 28,
        sodiumMg: 420,
        saturatedFatG: 6,
      },
    });

    const veganFriendly = product({
      id: "vegan-friendly",
      name: "비건 시리얼",
      category: "시리얼",
      ingredientsText: "귀리, 설탕",
      nutrition: {
        energyKcal: 360,
        sugarsG: 10,
        sodiumMg: 200,
        saturatedFatG: 2,
      },
    });

    const dairyCandidate = product({
      id: "dairy",
      name: "우유 시리얼",
      category: "시리얼",
      ingredientsText: "귀리, 우유",
      nutrition: {
        energyKcal: 340,
        sugarsG: 8,
        sodiumMg: 180,
        saturatedFatG: 2,
      },
    });

    const recommendations = buildAlternativeRecommendations(
      base,
      [veganFriendly, dairyCandidate],
      3,
      {
        foodAlerts: [],
        dietaryPreferences: ["vegan"],
      },
    );

    expect(recommendations.map((item) => item.product.id)).toEqual(["vegan-friendly"]);
  });

  it("allows computable alternatives when the base product has no score", () => {
    const base = product({
      id: "base",
      nutrition: { sugarsG: 2 },
      sources: ["ai_estimated"],
      status: "needs_review",
      confidence: 0.61,
    });

    const recommendations = buildAlternativeRecommendations(base, [
      product({
        id: "scored",
        name: "scored alternative",
        nutrition: { energyKcal: 90, sodiumMg: 80, sugarsG: 1, saturatedFatG: 0.5 },
        confidence: 0.7,
      }),
    ]);

    expect(recommendations.map((item) => item.product.id)).toEqual(["scored"]);
    expect(recommendations[0].scoreDelta).toBeNull();
    expect(recommendations[0].reasons).toContain("점수 산출 가능");
  });

  it("does not recommend shopping-only candidates without a computable food score", () => {
    const base = product({
      id: "base",
      name: "오레오 오즈",
      category: "시리얼",
      nutrition: { energyKcal: 400, sodiumMg: 156, sugarsG: 41, saturatedFatG: 3.7 },
    });

    const recommendations = buildAlternativeRecommendations(base, [
      product({
        id: "same-shopping",
        name: "오레오 오즈 500g",
        sources: ["shopping"],
        nutrition: {},
        shoppingOffer: {
          minPrice: 4900,
          priceText: "최저 4,900원",
          mallName: "N쇼핑",
          link: "https://shopping.naver.com/a",
        },
      }),
      product({
        id: "shopping-low",
        name: "통곡물 시리얼",
        brand: "대체식품몰",
        category: "시리얼",
        sources: ["shopping"],
        nutrition: {},
        shoppingOffer: {
          minPrice: 3200,
          priceText: "최저 3,200원",
          mallName: "대체식품몰",
          link: "https://shopping.naver.com/b",
        },
      }),
      product({
        id: "shopping-high",
        name: "저당 시리얼",
        brand: "N마켓",
        category: "시리얼",
        sources: ["shopping"],
        nutrition: {},
        shoppingOffer: {
          minPrice: 6200,
          priceText: "최저 6,200원",
          mallName: "N마켓",
          link: "https://shopping.naver.com/c",
        },
      }),
    ]);

    expect(recommendations).toEqual([]);
  });

  it("keeps purchase information on scored candidates without sorting by lowest price", () => {
    const base = product({
      id: "base",
      name: "오레오 오즈",
      category: "시리얼",
      nutrition: { energyKcal: 400, sodiumMg: 156, sugarsG: 41, saturatedFatG: 3.7 },
    });

    const recommendations = buildAlternativeRecommendations(base, [
      product({
        id: "better-score-expensive",
        name: "통곡물 시리얼",
        category: "시리얼",
        nutrition: { energyKcal: 120, sodiumMg: 60, sugarsG: 3, saturatedFatG: 0.5 },
        confidence: 0.9,
        shoppingOffer: {
          minPrice: 7200,
          priceText: "최저 7,200원",
          mallName: "N마켓",
          link: "https://shopping.naver.com/a",
        },
      }),
      product({
        id: "lower-score-cheaper",
        name: "저당 시리얼",
        category: "시리얼",
        nutrition: { energyKcal: 230, sodiumMg: 130, sugarsG: 5, saturatedFatG: 2 },
        confidence: 0.9,
        shoppingOffer: {
          minPrice: 3200,
          priceText: "최저 3,200원",
          mallName: "N쇼핑",
          link: "https://shopping.naver.com/b",
        },
      }),
    ]);

    expect(recommendations.map((item) => item.product.id)).toEqual([
      "better-score-expensive",
      "lower-score-cheaper",
    ]);
    expect(recommendations[0].kind).toBe("scored");
    expect(recommendations[0].product.shoppingOffer?.priceText).toBe("최저 7,200원");
    expect(recommendations[0].reasons).toContain("국내 구매 가능");
  });

  it("requires a B-grade or better candidate for alternatives", () => {
    const base = product({
      id: "base",
      category: "snack",
      nutrition: { energyKcal: 430, sodiumMg: 1200, sugarsG: 40, saturatedFatG: 9 },
    });

    const recommendations = buildAlternativeRecommendations(base, [
      product({
        id: "c-grade-improvement",
        category: "snack",
        nutrition: { energyKcal: 260, sodiumMg: 700, sugarsG: 12, saturatedFatG: 4 },
      }),
    ]);

    expect(recommendations).toEqual([]);
  });

  it("uses Gemini recommendations to reject broad-category candidates that are not true substitutes", async () => {
    const base = product({
      id: "spam",
      name: "Spam Mild",
      brand: "CJ",
      category: "processed meat",
      nutrition: { energyKcal: 320, sodiumMg: 1200, sugarsG: 1, saturatedFatG: 8 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const jokbal = product({
      id: "jokbal",
      name: "Black Garlic Pork Trotter",
      category: "processed meat",
      nutrition: { energyKcal: 90, sodiumMg: 80, sugarsG: 1, saturatedFatG: 0.5 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const luncheonMeat = product({
      id: "luncheon-meat",
      name: "Low Sodium Luncheon Meat",
      category: "processed meat",
      nutrition: { energyKcal: 95, sodiumMg: 120, sugarsG: 1, saturatedFatG: 1 },
      sources: ["public_api"],
      status: "public_matched",
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([jokbal, luncheonMeat]);
    mocks.searchNaverShopping.mockResolvedValue([]);
    mocks.recommendAlternativeProducts.mockResolvedValue({
      baseSubstituteGroup: "canned ham/luncheon meat",
      recommendations: [
        {
          productId: "luncheon-meat",
          fitScore: 92,
          substituteGroup: "canned ham/luncheon meat",
          reason: "캔햄/런천미트 계열로 사용 맥락이 유사합니다",
        },
      ],
      warnings: [],
    });

    const recommendations = await getAlternativeRecommendations(base);

    expect(mocks.recommendAlternativeProducts).toHaveBeenCalledWith(base, [jokbal, luncheonMeat]);
    expect(recommendations.map((item) => item.product.id)).toEqual(["luncheon-meat"]);
    expect(recommendations[0].reasons[0]).toBe("캔햄/런천미트 계열로 사용 맥락이 유사합니다");
  });

  it("does not fall back to broad category candidates when Gemini recommendation fails", async () => {
    const base = product({
      id: "base-cookie",
      name: "오레오",
      category: "과자",
      nutrition: { energyKcal: 480, sodiumMg: 460, sugarsG: 38, saturatedFatG: 9 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const broadCategoryCandidate = product({
      id: "yakgwa",
      name: "약과",
      category: "과자",
      nutrition: { energyKcal: 120, sodiumMg: 80, sugarsG: 1, saturatedFatG: 0.5 },
      sources: ["public_api"],
      status: "public_matched",
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([broadCategoryCandidate]);
    mocks.searchNaverShopping.mockResolvedValue([]);
    mocks.recommendAlternativeProducts.mockRejectedValue(new Error("Gemini unavailable"));

    const recommendations = await getAlternativeRecommendations(base);

    expect(recommendations).toEqual([]);
  });

  it("uses Gemini nutrition search plans for shopping alternatives instead of base keyword fallback", async () => {
    const base = product({
      id: "base-cookie",
      name: "오레오 초콜릿 샌드위치 쿠키",
      category: "과자",
      nutrition: { energyKcal: 480, sodiumMg: 460, sugarsG: 38, saturatedFatG: 9 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const keywordOnlyCandidate = product({
      id: "keyword-only-bar",
      name: "초코맛 단백질바",
      category: "과자",
      nutrition: { energyKcal: 120, sodiumMg: 80, sugarsG: 1, saturatedFatG: 0.5 },
      sources: ["shopping"],
      status: "open_db_matched",
      shoppingOffer: {
        minPrice: 3000,
        priceText: "최저 3,000원",
        mallName: "네이버",
        link: "https://shopping.example/protein-bar",
      },
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([]);
    mocks.recommendAlternativeShoppingSearches.mockResolvedValue({
      baseNutritionBurden: "당류와 포화지방 부담이 높음",
      searches: [
        {
          query: "저당 통밀 쿠키",
          targetFood: "저당 통밀 쿠키",
          reason: "당류 부담을 낮춘 같은 간식 대체안입니다.",
          nutritionFocus: ["당류 감소", "포화지방 감소"],
        },
      ],
      warnings: [],
    });
    mocks.searchNaverShopping.mockResolvedValue([keywordOnlyCandidate]);
    mocks.verifyAlternativeShoppingResults.mockResolvedValue({
      recommendations: [
        {
          productId: "keyword-only-bar",
          fitScore: 88,
          reason: "Gemini가 영양 대체식품으로 확인했습니다.",
          nutritionFocus: ["당류 감소"],
        },
      ],
      warnings: [],
    });

    const recommendations = await getAlternativeRecommendations(base);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      product: { id: "keyword-only-bar" },
      score: null,
      grade: null,
      scoreDelta: null,
      kind: "shopping",
    });
    expect(recommendations[0].reasons).toContain("당류 감소");
    expect(mocks.searchNaverShopping).not.toHaveBeenCalledWith("과자");
    expect(mocks.searchNaverShopping).toHaveBeenCalledWith("저당 통밀 쿠키");
    expect(mocks.recommendAlternativeProducts).not.toHaveBeenCalled();
  });

  it("uses Gemini to verify Naver Shopping results before selecting an alternative", async () => {
    const base = product({
      id: "base-cookie",
      name: "오레오 초콜릿 샌드위치 쿠키",
      category: "과자",
      nutrition: { energyKcal: 480, sodiumMg: 460, sugarsG: 38, saturatedFatG: 9 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const sameProduct = product({
      id: "naver-same",
      name: "오레오 초콜릿 샌드위치 쿠키 100g",
      sources: ["shopping"],
      nutrition: {},
      shoppingOffer: {
        minPrice: 2500,
        priceText: "최저 2,500원",
        mallName: "네이버",
        link: "https://shopping.example/oreo",
      },
    });
    const verifiedAlternative = product({
      id: "naver-alternative",
      name: "저당 통밀 쿠키",
      sources: ["shopping"],
      nutrition: {},
      shoppingOffer: {
        minPrice: 3400,
        priceText: "최저 3,400원",
        mallName: "네이버",
        link: "https://shopping.example/whole-cookie",
      },
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([]);
    mocks.recommendAlternativeShoppingSearches.mockResolvedValue({
      baseNutritionBurden: "당류와 포화지방 부담이 높음",
      searches: [
        {
          query: "저당 통밀 쿠키",
          targetFood: "저당 통밀 쿠키",
          reason: "당류 부담을 낮춘 간식 대체안입니다.",
          nutritionFocus: ["당류 감소", "포화지방 감소"],
        },
      ],
      warnings: [],
    });
    mocks.searchNaverShopping.mockResolvedValue([sameProduct, verifiedAlternative]);
    mocks.verifyAlternativeShoppingResults.mockResolvedValue({
      recommendations: [
        {
          productId: "naver-alternative",
          fitScore: 91,
          reason: "같은 간식 맥락에서 더 나은 대체안입니다.",
          nutritionFocus: ["당류 감소"],
        },
      ],
      warnings: [],
    });

    const recommendations = await getAlternativeRecommendations(base);

    expect(mocks.verifyAlternativeShoppingResults).toHaveBeenCalledWith(
      base,
      expect.objectContaining({ query: "저당 통밀 쿠키" }),
      [sameProduct, verifiedAlternative],
    );
    expect(recommendations.map((item) => item.product.id)).toEqual(["naver-alternative"]);
    expect(recommendations[0].reasons).toContain("같은 간식 맥락에서 더 나은 대체안입니다.");
  });

  it("uses Open Food Facts nutrition to score a Gemini-verified shopping alternative", async () => {
    const base = product({
      id: "base-cookie",
      name: "오레오 초콜릿 샌드위치 쿠키",
      category: "과자",
      nutrition: { energyKcal: 480, sodiumMg: 460, sugarsG: 38, saturatedFatG: 9 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const shoppingAlternative = product({
      id: "naver-whole-cookie",
      name: "저당 통밀 쿠키 100g",
      sources: ["shopping"],
      nutrition: {},
      shoppingOffer: {
        minPrice: 3400,
        priceText: "최저 3,400원",
        mallName: "네이버",
        link: "https://shopping.example/whole-cookie",
      },
    });
    const openFoodFactsMatch = product({
      id: "off-whole-cookie",
      barcode: "1234567890123",
      name: "저당 통밀 쿠키",
      brand: "Better",
      sources: ["open_db"],
      status: "open_db_matched",
      nutrition: { energyKcal: 260, sodiumMg: 120, sugarsG: 4, saturatedFatG: 1 },
      confidence: 0.86,
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([]);
    mocks.recommendAlternativeShoppingSearches.mockResolvedValue({
      baseNutritionBurden: "당류와 포화지방 부담이 높음",
      searches: [
        {
          query: "저당 통밀 쿠키",
          targetFood: "저당 통밀 쿠키",
          reason: "당류 부담을 낮춘 간식 대체안입니다.",
          nutritionFocus: ["당류 감소"],
        },
      ],
      warnings: [],
    });
    mocks.searchNaverShopping.mockResolvedValue([shoppingAlternative]);
    mocks.verifyAlternativeShoppingResults.mockResolvedValue({
      recommendations: [
        {
          productId: "naver-whole-cookie",
          fitScore: 91,
          reason: "같은 간식 맥락에서 더 나은 대체안입니다.",
          nutritionFocus: ["당류 감소"],
        },
      ],
      warnings: [],
    });
    mocks.searchOpenFoodFacts.mockResolvedValue([openFoodFactsMatch]);

    const recommendations = await getAlternativeRecommendations(base);

    expect(mocks.searchOpenFoodFacts).toHaveBeenCalledWith("저당 통밀 쿠키 100g");
    expect(recommendations[0]).toMatchObject({
      product: {
        id: "naver-whole-cookie",
        barcode: "1234567890123",
        nutrition: { sugarsG: 4, saturatedFatG: 1 },
      },
      kind: "scored",
      grade: "B",
    });
    expect(recommendations[0].score).toBeGreaterThanOrEqual(70);
  });

  it("matches shopping offers when a shopping title inserts descriptive words", async () => {
    const base = product({
      id: "base-gochujang",
      name: "일반 고추장",
      category: "고추장",
      nutrition: { energyKcal: 260, sodiumMg: 980, sugarsG: 22, saturatedFatG: 1 },
      additives: ["보존료"],
      sources: ["public_api"],
      status: "public_matched",
    });
    const alternative = product({
      id: "alt-halmae",
      name: "할매손맛 고추장",
      brand: "어울림바이오",
      category: "고추장",
      nutrition: { energyKcal: 130, sodiumMg: 420, sugarsG: 4, saturatedFatG: 0.2 },
      sources: ["public_api"],
      status: "public_matched",
      confidence: 0.92,
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([alternative]);
    mocks.searchNaverShopping.mockImplementation(async (query: string) =>
      query === "어울림바이오 할매손맛 고추장"
        ? [
            product({
              id: "shopping-halmae",
              name: "어울림바이오 할매손맛 찹쌀 고추장 1kg",
              brand: "어울림바이오",
              imageUrl: "https://example.com/halmae-gochujang.jpg",
              sources: ["shopping"],
              shoppingOffer: {
                minPrice: 6900,
                priceText: "최저 6,900원",
                mallName: "네이버",
                link: "https://shopping.example/halmae",
              },
            }),
          ]
        : [],
    );

    const recommendations = await getAlternativeRecommendations(base);

    expect(recommendations[0].product.id).toBe("alt-halmae");
    expect(recommendations[0].product.imageUrl).toBe("https://example.com/halmae-gochujang.jpg");
    expect(recommendations[0].product.shoppingOffer?.priceText).toBe("최저 6,900원");
    expect(recommendations[0].reasons).toContain("국내 구매 가능");
  });

  it("enriches recommended alternatives with shopping images using each candidate name", async () => {
    const base = product({
      id: "base-ramen",
      name: "신라면",
      category: "라면",
      nutrition: { energyKcal: 430, sodiumMg: 1400, sugarsG: 5, saturatedFatG: 7 },
      sources: ["public_api"],
      status: "public_matched",
    });
    const alternative = product({
      id: "alt-black-pork",
      name: "흑돼지라면",
      brand: "(주)나면서산공장",
      category: "라면",
      nutrition: { energyKcal: 260, sodiumMg: 480, sugarsG: 1, saturatedFatG: 1 },
      sources: ["public_api"],
      status: "public_matched",
      confidence: 0.92,
    });

    mocks.searchAlternativeCandidates.mockResolvedValue([alternative]);
    mocks.searchNaverShopping.mockImplementation(async (query: string) =>
      query === "흑돼지라면"
        ? [
            product({
              id: "shopping-black-pork",
              name: "제주 돗멘 흑돼지 라면 봉지면",
              brand: "돗멘",
              imageUrl: "https://example.com/black-pork.jpg",
              sources: ["shopping"],
              shoppingOffer: {
                minPrice: 4500,
                priceText: "최저 4,500원",
                mallName: "네이버",
                link: "https://shopping.example/black-pork",
              },
            }),
          ]
        : [],
    );

    const recommendations = await getAlternativeRecommendations(base);

    expect(recommendations[0].product.id).toBe("alt-black-pork");
    expect(recommendations[0].product.imageUrl).toBe("https://example.com/black-pork.jpg");
    expect(recommendations[0].product.shoppingOffer?.link).toBe(
      "https://shopping.example/black-pork",
    );
    expect(mocks.searchNaverShopping).toHaveBeenCalledWith("흑돼지라면");
  });
});
