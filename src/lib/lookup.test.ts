import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "./types";

const getProductById = vi.fn();
const lookupVerifiedProduct = vi.fn();
const lookupC005 = vi.fn();
const lookupI2570 = vi.fn();
const lookupI0490 = vi.fn();
const enrichProduct = vi.fn();
const searchI1250 = vi.fn();
const lookupOpenFoodFactsByBarcode = vi.fn();
const searchOpenFoodFacts = vi.fn();
const selectBestProductCandidate = vi.fn();
const applyProductCandidateSelection = vi.fn();
const pickFallbackProductCandidate = vi.fn();
const translateProductToKoreanIfNeeded = vi.fn();

vi.mock("./storage", () => ({
  getProductById,
}));

vi.mock("./supabase-api", () => ({
  lookupVerifiedProduct,
}));

vi.mock("./public-api", () => ({
  lookupC005,
  lookupI2570,
  lookupI0490,
  enrichProduct,
  lookupOpenFoodFactsByBarcode,
  searchI1250,
  searchOpenFoodFacts,
}));

vi.mock("./product-selection", () => ({
  selectBestProductCandidate,
  applyProductCandidateSelection,
  pickFallbackProductCandidate,
}));

vi.mock("./product-translation", () => ({
  translateProductToKoreanIfNeeded,
}));

const product: Product = {
  id: "ocr-1778693586342",
  name: "OCR product",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: ["ai_estimated"],
  status: "provisional",
  confidence: 0.7,
  updatedAt: "2026-05-14T00:00:00.000Z",
};

describe("lookupBarcode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupI0490.mockResolvedValue({ recall: null, error: false });
    lookupVerifiedProduct.mockResolvedValue(null);
    lookupC005.mockResolvedValue(null);
    lookupI2570.mockResolvedValue(null);
    lookupOpenFoodFactsByBarcode.mockResolvedValue(null);
    searchOpenFoodFacts.mockResolvedValue([]);
    translateProductToKoreanIfNeeded.mockImplementation(async (input: Product) => ({
      product: input,
      translated: false,
    }));
  });

  it("resolves OCR provisional ids from local storage without querying barcode APIs", async () => {
    getProductById.mockReturnValue(product);
    const { lookupBarcode } = await import("./lookup");

    const result = await lookupBarcode("ocr-1778693586342");

    expect(result.product).toBe(product);
    expect(lookupVerifiedProduct).not.toHaveBeenCalled();
    expect(lookupC005).not.toHaveBeenCalled();
    expect(lookupI2570).not.toHaveBeenCalled();
    expect(lookupOpenFoodFactsByBarcode).not.toHaveBeenCalled();
    expect(selectBestProductCandidate).not.toHaveBeenCalled();
    expect(result.stages.map((stage) => stage.status)).toEqual([
      "ok",
      "skipped",
      "skipped",
      "skipped",
    ]);
  });

  it("applies Korean translation to local OCR products with non-barcode ids", async () => {
    const foreignOcrProduct: Product = {
      ...product,
      ingredientsText: "FRUCTOSE, TRICALCIUM PHOSPHATE, STEVIOL GLYCOSIDES",
      ingredients: ["FRUCTOSE", "TRICALCIUM PHOSPHATE", "STEVIOL GLYCOSIDES"],
    };
    const translatedProduct: Product = {
      ...foreignOcrProduct,
      ingredientsText: "과당, 제삼인산칼슘, 스테비올배당체",
      ingredients: ["과당", "제삼인산칼슘", "스테비올배당체"],
    };
    getProductById.mockReturnValue(foreignOcrProduct);
    translateProductToKoreanIfNeeded.mockResolvedValue({
      product: translatedProduct,
      translated: true,
    });
    const { lookupBarcode } = await import("./lookup");

    const result = await lookupBarcode("ocr-1778693586342");

    expect(result.product).toBe(translatedProduct);
    expect(translateProductToKoreanIfNeeded).toHaveBeenCalledWith(foreignOcrProduct);
    expect(result.stages[3]).toMatchObject({
      key: "ai",
      status: "ok",
      message: "한국어 번역 적용",
    });
  });

  it("applies Korean AI translation after selecting an Open Food Facts candidate", async () => {
    const foreignProduct: Product = {
      id: "5449000054227",
      barcode: "5449000054227",
      name: "Coca-Cola",
      brand: "Coca-Cola",
      category: "Beverages",
      ingredientsText: "Water, fructose-glucose syrup, carbon dioxide.",
      ingredients: ["Water", "fructose-glucose syrup", "carbon dioxide"],
      allergens: [],
      additives: ["E150D"],
      nutrition: {},
      sources: ["open_db"],
      status: "open_db_matched",
      confidence: 0.85,
      updatedAt: "2026-05-14T00:00:00.000Z",
    };
    const translatedProduct: Product = {
      ...foreignProduct,
      name: "코카콜라",
      category: "음료",
      ingredientsText: "정제수, 포도당과당시럽, 이산화탄소.",
      ingredients: ["정제수", "포도당과당시럽", "이산화탄소"],
    };
    getProductById.mockReturnValue(null);
    lookupOpenFoodFactsByBarcode.mockResolvedValue(foreignProduct);
    selectBestProductCandidate.mockResolvedValue({
      selectedIndex: 0,
      confidence: 0.9,
      reason: "공개 DB 후보 선택",
      warnings: [],
    });
    applyProductCandidateSelection.mockReturnValue(foreignProduct);
    translateProductToKoreanIfNeeded.mockResolvedValue({
      product: translatedProduct,
      translated: true,
    });
    const { lookupBarcode } = await import("./lookup");

    const result = await lookupBarcode("5449000054227");

    expect(result.product).toBe(translatedProduct);
    expect(translateProductToKoreanIfNeeded).toHaveBeenCalledWith(foreignProduct);
    expect(result.stages[3]).toMatchObject({
      key: "ai",
      status: "ok",
      message: "한국어 번역 적용",
    });
  });

  it("enriches an Open Food Facts candidate before candidate selection", async () => {
    const openFoodFactsProduct: Product = {
      id: "8801117775001",
      barcode: "8801117775001",
      name: "스윙칩",
      brand: "오리온",
      category: "snacks",
      ingredients: [],
      allergens: [],
      additives: [],
      nutrition: {
        energyKcal: 586.67,
        sugarsG: 3.33,
        proteinG: 6.67,
      },
      sources: ["open_db"],
      status: "open_db_matched",
      confidence: 0.85,
      updatedAt: "2026-05-14T00:00:00.000Z",
    };
    const enrichedProduct: Product = {
      ...openFoodFactsProduct,
      reportNo: "19870415003244",
      nutrition: {
        energyKcal: 586.67,
        sugarsG: 3.33,
        sodiumMg: 467,
        saturatedFatG: 14.33,
        proteinG: 6.67,
      },
      sources: ["open_db", "public_api"],
    };
    getProductById.mockReturnValue(null);
    lookupOpenFoodFactsByBarcode.mockResolvedValue(openFoodFactsProduct);
    enrichProduct.mockResolvedValue(enrichedProduct);
    selectBestProductCandidate.mockResolvedValue({
      selectedIndex: 0,
      confidence: 0.88,
      reason: "공개 DB 후보를 영양 DB로 보강",
      warnings: [],
    });
    applyProductCandidateSelection.mockReturnValue(enrichedProduct);
    const { lookupBarcode } = await import("./lookup");

    const result = await lookupBarcode("8801117775001");

    expect(enrichProduct).toHaveBeenCalledWith(openFoodFactsProduct);
    expect(selectBestProductCandidate).toHaveBeenCalledWith("8801117775001", [
      { source: "open_food_facts", product: enrichedProduct },
    ]);
    expect(result.product).toBe(enrichedProduct);
  });

  it("keeps the original Open Food Facts candidate when enrichment fails", async () => {
    const openFoodFactsProduct: Product = {
      id: "8801117775001",
      barcode: "8801117775001",
      name: "스윙칩",
      brand: "오리온",
      category: "snacks",
      ingredients: [],
      allergens: [],
      additives: [],
      nutrition: {
        energyKcal: 586.67,
        sugarsG: 3.33,
        proteinG: 6.67,
      },
      sources: ["open_db"],
      status: "open_db_matched",
      confidence: 0.85,
      updatedAt: "2026-05-14T00:00:00.000Z",
    };
    getProductById.mockReturnValue(null);
    lookupOpenFoodFactsByBarcode.mockResolvedValue(openFoodFactsProduct);
    enrichProduct.mockRejectedValue(new Error("nutrition enrichment failed"));
    selectBestProductCandidate.mockResolvedValue({
      selectedIndex: 0,
      confidence: 0.8,
      reason: "공개 DB 원본 후보 사용",
      warnings: [],
    });
    applyProductCandidateSelection.mockReturnValue(openFoodFactsProduct);
    const { lookupBarcode } = await import("./lookup");

    const result = await lookupBarcode("8801117775001");

    expect(selectBestProductCandidate).toHaveBeenCalledWith("8801117775001", [
      { source: "open_food_facts", product: openFoodFactsProduct },
    ]);
    expect(result.product).toBe(openFoodFactsProduct);
    expect(result.stages[2]).toMatchObject({ key: "open_food_facts", status: "ok" });
  });
});
