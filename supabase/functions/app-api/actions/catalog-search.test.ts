import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lookupOpenFoodFactsByBarcodeInternal,
  searchOpenFoodFactsInternal,
} from "./catalog-search.ts";

describe("Open Food Facts barcode lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps the front image from a registered barcode product", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          code: "8801234567890",
          product_name: "테스트 라면",
          brands: "테스트식품",
          image_front_url: "https://images.openfoodfacts.org/front.jpg",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const product = await lookupOpenFoodFactsByBarcodeInternal("880-1234567890");

    expect(product).toMatchObject({
      barcode: "8801234567890",
      name: "테스트 라면",
      imageUrl: "https://images.openfoodfacts.org/front.jpg",
      sources: ["open_db"],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://world.openfoodfacts.org/api/v0/product/8801234567890.json",
      expect.any(Object),
    );
  });

  it("returns null when Open Food Facts has no product for the barcode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 0 }),
      }),
    );

    await expect(lookupOpenFoodFactsByBarcodeInternal("8800000000000")).resolves.toBeNull();
  });

  it("returns null instead of propagating transient Open Food Facts 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      }),
    );

    await expect(lookupOpenFoodFactsByBarcodeInternal("8801043014809")).resolves.toBeNull();
  });

  it("returns null when Open Food Facts barcode lookup cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(lookupOpenFoodFactsByBarcodeInternal("8801043014809")).resolves.toBeNull();
  });
});

describe("Open Food Facts search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty result instead of propagating transient Open Food Facts 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    await expect(searchOpenFoodFactsInternal("저당 통밀 쿠키")).resolves.toEqual([]);
  });

  it("returns an empty result when Open Food Facts search cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(searchOpenFoodFactsInternal("저당 통밀 쿠키")).resolves.toEqual([]);
  });
});
