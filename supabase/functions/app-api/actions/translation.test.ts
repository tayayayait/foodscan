import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../_shared/types.ts";
import {
  applyKoreanProductTranslation,
  normalizeProductKoreanTranslation,
  translateProductToKoreanInternal,
} from "./translation.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const product: Product = {
  id: "5449000054227",
  barcode: "5449000054227",
  name: "Coca-Cola",
  brand: "Coca-Cola",
  category: "Beverages",
  quantity: "330ml",
  ingredientsText: "Water, fructose-glucose syrup, carbon dioxide.",
  ingredients: ["Water", "fructose-glucose syrup", "carbon dioxide"],
  allergens: ["milk"],
  additives: ["E150D"],
  nutrition: { sugarsG: 10.6 },
  sources: ["open_db"],
  status: "open_db_matched",
  confidence: 0.85,
  updatedAt: "2026-05-14T00:00:00.000Z",
};

describe("Korean product translation normalization", () => {
  it("preserves ingredient order and fills missing translated items with originals", () => {
    const translation = normalizeProductKoreanTranslation(
      {
        name: "코카콜라",
        category: "음료",
        ingredientsText: "정제수, 포도당과당시럽, 이산화탄소.",
        ingredients: ["정제수", "포도당과당시럽"],
        allergens: [],
        warnings: ["일부 항목 원문 유지"],
      },
      product,
    );

    expect(translation.ingredients).toEqual(["정제수", "포도당과당시럽", "carbon dioxide"]);
    expect(translation.allergens).toEqual(["milk"]);
    expect(translation.warnings).toEqual(["일부 항목 원문 유지"]);
  });

  it("applies translated display fields without changing facts or source metadata", () => {
    const translated = applyKoreanProductTranslation(product, {
      name: "코카콜라",
      category: "음료",
      ingredientsText: "정제수, 포도당과당시럽, 이산화탄소.",
      ingredients: ["정제수", "포도당과당시럽", "이산화탄소"],
      allergens: ["우유"],
      warnings: [],
    });

    expect(translated).toMatchObject({
      id: product.id,
      barcode: product.barcode,
      nutrition: product.nutrition,
      sources: product.sources,
      status: product.status,
      confidence: product.confidence,
      name: "코카콜라",
      category: "음료",
      ingredients: ["정제수", "포도당과당시럽", "이산화탄소"],
      allergens: ["우유"],
    });
  });

  it("returns a structured timeout before the Supabase idle timeout when Gemini stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Deno", {
      env: {
        toObject: () => ({ GEMINI_API_KEY: "test-key" }),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const translation = translateProductToKoreanInternal(product);
    const assertion = expect(translation).rejects.toMatchObject({
      name: "HttpError",
      status: 504,
      code: "UPSTREAM_TIMEOUT",
      message: "Gemini product translation timed out",
    });
    await vi.advanceTimersByTimeAsync(12_000);

    await assertion;
  });
});
