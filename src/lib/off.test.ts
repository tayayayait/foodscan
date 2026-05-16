import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getByBarcode } from "./off";

describe("getByBarcode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the product endpoint that returns status 0 for missing barcodes", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "8801117114107",
          status: 0,
          status_verbose: "product not found",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getByBarcode("8801117114107")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://world.openfoodfacts.org/api/v0/product/8801117114107.json",
    );
  });

  it("normalizes matched product payloads", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            code: "3017620422003",
            product_name: "Nutella",
            brands: "Ferrero",
            nutriments: {
              "energy-kcal_100g": 539,
              sugars_100g: 56.3,
              sodium_100g: 0.04,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getByBarcode("3017620422003")).resolves.toMatchObject({
      id: "3017620422003",
      barcode: "3017620422003",
      name: "Nutella",
      brand: "Ferrero",
      nutrition: {
        energyKcal: 539,
        sugarsG: 56.3,
        sodiumMg: 40,
      },
      sources: ["open_db"],
      status: "open_db_matched",
    });
  });
});
