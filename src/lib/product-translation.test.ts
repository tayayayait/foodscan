import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "./types";
import {
  shouldTranslateProductToKorean,
  translateProductToKoreanIfNeeded,
} from "./product-translation";

const { callAppEdgeFunctionMock } = vi.hoisted(() => ({
  callAppEdgeFunctionMock: vi.fn(),
}));

vi.mock("./edge-function-client", () => ({
  callAppEdgeFunction: callAppEdgeFunctionMock,
}));

const product = (overrides: Partial<Product> = {}): Product => ({
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
  ...overrides,
});

describe("product translation", () => {
  beforeEach(() => {
    callAppEdgeFunctionMock.mockReset();
  });

  it("detects Open Food Facts products with foreign ingredient text", () => {
    expect(shouldTranslateProductToKorean(product())).toBe(true);
  });

  it("detects public API products with foreign package ingredient text", () => {
    expect(
      shouldTranslateProductToKorean(
        product({
          sources: ["public_api"],
          status: "public_matched",
        }),
      ),
    ).toBe(true);
  });

  it("skips already Korean product detail text", async () => {
    const korean = product({
      name: "콜라",
      category: "탄산음료",
      ingredientsText: "정제수, 설탕, 이산화탄소",
      ingredients: ["정제수", "설탕", "이산화탄소"],
    });

    await expect(translateProductToKoreanIfNeeded(korean)).resolves.toEqual({
      product: korean,
      translated: false,
    });
    expect(callAppEdgeFunctionMock).not.toHaveBeenCalled();
  });

  it("returns the translated product from the edge function", async () => {
    const original = product();
    const translated = product({
      name: "코카콜라",
      category: "음료",
      ingredientsText: "정제수, 포도당과당시럽, 이산화탄소.",
      ingredients: ["정제수", "포도당과당시럽", "이산화탄소"],
    });
    callAppEdgeFunctionMock.mockResolvedValue(translated);

    await expect(translateProductToKoreanIfNeeded(original)).resolves.toEqual({
      product: translated,
      translated: true,
    });
    expect(callAppEdgeFunctionMock).toHaveBeenCalledWith(
      "translateProductToKorean",
      {
        product: original,
      },
      {
        timeoutMs: 15_000,
      },
    );
  });

  it("falls back to the original product when translation fails", async () => {
    const original = product();
    callAppEdgeFunctionMock.mockRejectedValue(new Error("no gemini"));

    await expect(translateProductToKoreanIfNeeded(original)).resolves.toEqual({
      product: original,
      translated: false,
    });
  });
});
