import { describe, expect, it } from "vitest";
import {
  isSavedProduct,
  removeSavedProduct,
  savedProductItems,
  toggleSavedProduct,
  upsertSavedProduct,
} from "./saved-products";
import type { Product } from "./types";

const product = (id: string, name = id): Product => ({
  id,
  name,
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
  confidence: 0.9,
  updatedAt: "2026-05-13T00:00:00.000Z",
});

describe("saved products", () => {
  it("adds a product to the front and stores the saved timestamp", () => {
    const result = upsertSavedProduct([], product("p1"), "2026-05-13T01:00:00.000Z");

    expect(result).toEqual([
      {
        product: product("p1"),
        savedAt: "2026-05-13T01:00:00.000Z",
      },
    ]);
    expect(isSavedProduct(result, "p1")).toBe(true);
  });

  it("deduplicates by product id and moves the latest saved product to the front", () => {
    const first = upsertSavedProduct([], product("p1", "old"), "2026-05-13T01:00:00.000Z");
    const second = upsertSavedProduct(first, product("p2"), "2026-05-13T02:00:00.000Z");
    const third = upsertSavedProduct(second, product("p1", "new"), "2026-05-13T03:00:00.000Z");

    expect(third.map((item) => item.product.id)).toEqual(["p1", "p2"]);
    expect(third[0].product.name).toBe("new");
    expect(third[0].savedAt).toBe("2026-05-13T03:00:00.000Z");
  });

  it("removes a saved product by id", () => {
    const items = [
      { product: product("p1"), savedAt: "2026-05-13T01:00:00.000Z" },
      { product: product("p2"), savedAt: "2026-05-13T02:00:00.000Z" },
    ];

    expect(removeSavedProduct(items, "p1").map((item) => item.product.id)).toEqual(["p2"]);
  });

  it("toggles saved state and exposes product snapshots", () => {
    const added = toggleSavedProduct([], product("p1"), "2026-05-13T01:00:00.000Z");
    const removed = toggleSavedProduct(added, product("p1"), "2026-05-13T02:00:00.000Z");

    expect(savedProductItems(added).map((item) => item.id)).toEqual(["p1"]);
    expect(removed).toEqual([]);
  });
});
