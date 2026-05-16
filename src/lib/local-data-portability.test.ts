import { describe, expect, it } from "vitest";
import {
  LOCAL_DATA_EXPORT_APP,
  LOCAL_DATA_EXPORT_VERSION,
  buildLocalDataExport,
  localDataExportFileName,
  mergeLocalDataExports,
  parseLocalDataExport,
  summarizeLocalDataExport,
} from "./local-data-portability";
import type { SavedProductItem } from "./saved-products";
import type { Product } from "./types";

const product = (id: string, name = id): Product => ({
  id,
  name,
  ingredients: ["milk"],
  allergens: ["milk"],
  additives: [],
  nutrition: { energyKcal: 100 },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.9,
  updatedAt: "2026-05-13T00:00:00.000Z",
});

const saved = (id: string): SavedProductItem => ({
  product: product(id),
  savedAt: "2026-05-13T01:00:00.000Z",
});

describe("local data portability", () => {
  it("builds a versioned local data export and normalizes preferences", () => {
    const exported = buildLocalDataExport(
      {
        recent: [product("recent-1")],
        savedProducts: [saved("saved-1")],
        provisional: [],
        preferences: {
          preset: "unknown",
          allergens: ["우유", "밀", "계란"],
          foodAlerts: ["soy", "soy", "invalid"],
          dietaryPreferences: ["vegan", "invalid"],
          nutritionLimits: { sugarsG: 12, sodiumMg: -1 },
          avoidAdditiveRiskLevels: ["high_risk", "invalid"],
        },
        ocrDrafts: [],
        recentSearches: ["  ramen  ", "ramen", ""],
      },
      "2026-05-13T02:00:00.000Z",
    );

    expect(exported).toEqual(
      expect.objectContaining({
        app: LOCAL_DATA_EXPORT_APP,
        version: LOCAL_DATA_EXPORT_VERSION,
        exportedAt: "2026-05-13T02:00:00.000Z",
      }),
    );
    expect(exported.data.preferences).toEqual({
      foodAlerts: ["soy", "lactose", "gluten"],
      dietaryPreferences: ["vegan"],
    });
    expect(exported.data.recentSearches).toEqual(["ramen"]);
  });

  it("parses backup JSON and rejects incompatible payloads", () => {
    const raw = JSON.stringify(
      buildLocalDataExport(
        {
          recent: [product("p1")],
          savedProducts: [],
          provisional: [],
          preferences: null,
          ocrDrafts: [],
          recentSearches: [],
        },
        "2026-05-13T03:00:00.000Z",
      ),
    );

    expect(parseLocalDataExport(raw)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ exportedAt: "2026-05-13T03:00:00.000Z" }),
      }),
    );
    expect(parseLocalDataExport("{")).toEqual({ ok: false, error: "invalid_json" });
    expect(parseLocalDataExport(JSON.stringify({ app: "other", version: 1, data: {} }))).toEqual({
      ok: false,
      error: "unsupported_app",
    });
    expect(
      parseLocalDataExport(JSON.stringify({ app: LOCAL_DATA_EXPORT_APP, version: 99, data: {} })),
    ).toEqual({
      ok: false,
      error: "unsupported_version",
    });
  });

  it("deduplicates and limits imported local data", () => {
    const manyProducts = Array.from({ length: 12 }, (_, index) => product(`recent-${index}`));
    const manySaved = Array.from({ length: 55 }, (_, index) => saved(`saved-${index}`));
    const exported = buildLocalDataExport({
      recent: [product("recent-0", "latest"), product("recent-0", "older"), ...manyProducts],
      savedProducts: [saved("saved-0"), saved("saved-0"), ...manySaved],
      provisional: Array.from({ length: 52 }, (_, index) => product(`draft-${index}`)),
      preferences: null,
      ocrDrafts: Array.from({ length: 6 }, (_, index) => ({
        id: `ocr-${index}`,
        imageUrl: `data:image/png;base64,${index}`,
        createdAt: "2026-05-13T00:00:00.000Z",
        result: {
          productName: "OCR",
          brand: "",
          quantity: "",
          category: "",
          barcode: "",
          ingredientsText: "",
          ingredients: [],
          allergens: [],
          additives: [],
          nutrition: {},
          confidence: 0.8,
          warnings: [],
        },
      })),
      recentSearches: ["a", "b", "a", "c", "d", "e", "f"],
    });

    expect(exported.data.recent).toHaveLength(10);
    expect(exported.data.recent[0].name).toBe("latest");
    expect(exported.data.savedProducts).toHaveLength(50);
    expect(exported.data.provisional).toHaveLength(50);
    expect(exported.data.ocrDrafts).toHaveLength(5);
    expect(exported.data.recentSearches).toEqual(["a", "b", "c", "d", "e"]);
    expect(summarizeLocalDataExport(exported)).toEqual({
      recentCount: 10,
      savedCount: 50,
      provisionalCount: 50,
      hasPreferences: false,
      ocrDraftCount: 5,
      recentSearchCount: 5,
    });
  });

  it("generates a deterministic JSON backup file name", () => {
    expect(localDataExportFileName("2026-05-13T02:03:04.000Z")).toBe(
      "food-scan-local-data-20260513.json",
    );
  });

  it("merges server and local exports without duplicating history", () => {
    const server = buildLocalDataExport(
      {
        recent: [product("p1", "server"), product("p2")],
        savedProducts: [saved("s1")],
        provisional: [],
        preferences: { foodAlerts: ["soy"], dietaryPreferences: [] },
        ocrDrafts: [],
        recentSearches: ["ramen", "milk"],
      },
      "2026-05-13T04:00:00.000Z",
    );
    const local = buildLocalDataExport(
      {
        recent: [product("p1", "local"), product("p3")],
        savedProducts: [saved("s1"), saved("s2")],
        provisional: [],
        preferences: { foodAlerts: ["lactose"], dietaryPreferences: ["vegan"] },
        ocrDrafts: [],
        recentSearches: ["milk", "bread"],
      },
      "2026-05-13T05:00:00.000Z",
    );

    const merged = mergeLocalDataExports(server, local, "2026-05-13T06:00:00.000Z");

    expect(merged.exportedAt).toBe("2026-05-13T06:00:00.000Z");
    expect(merged.data.recent.map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
    expect(merged.data.recent[0].name).toBe("server");
    expect(merged.data.savedProducts.map((item) => item.product.id)).toEqual(["s1", "s2"]);
    expect(merged.data.preferences).toEqual({ foodAlerts: ["soy"], dietaryPreferences: [] });
    expect(merged.data.recentSearches).toEqual(["ramen", "milk", "bread"]);
  });
});
