import { describe, expect, it } from "vitest";
import {
  mergeHaccpPackagingInfo,
  selectPhotoEnrichmentCandidate,
  selectShoppingImageCandidate,
} from "./enrichment.ts";
import type { Product } from "../_shared/types.ts";

const product = (overrides: Partial<Product>): Product => ({
  id: overrides.id ?? "p",
  name: overrides.name ?? "계란과자",
  brand: overrides.brand,
  category: overrides.category,
  imageUrl: overrides.imageUrl,
  quantity: overrides.quantity,
  ingredientsText: overrides.ingredientsText,
  ingredients: overrides.ingredients ?? [],
  allergens: overrides.allergens ?? [],
  additives: overrides.additives ?? [],
  nutrition: overrides.nutrition ?? {},
  sources: overrides.sources ?? ["public_api"],
  status: overrides.status ?? "public_matched",
  confidence: overrides.confidence ?? 0.84,
  reportNo: overrides.reportNo,
  shoppingOffer: overrides.shoppingOffer,
  updatedAt: overrides.updatedAt ?? "2026-05-14T00:00:00.000Z",
});

describe("HACCP packaging enrichment", () => {
  it("replaces generic public ingredients with richer packaging-label ingredients", () => {
    const enriched = mergeHaccpPackagingInfo(
      product({
        ingredientsText: "물엿, 식품첨가물",
        ingredients: ["물엿", "식품첨가물"],
      }),
      {
        reportNo: "report",
        ingredientsText: "물엿, 고추양념, 쌀",
        ingredients: ["물엿", "고추양념", "쌀"],
        allergens: ["대두 함유"],
        imageUrl: "https://example.com/label.jpg",
        quantity: "1kg",
      },
    );

    expect(enriched.ingredientsText).toBe("물엿, 고추양념, 쌀");
    expect(enriched.ingredients).toEqual(["물엿", "고추양념", "쌀"]);
    expect(enriched.allergens).toEqual(["대두 함유"]);
    expect(enriched.imageUrl).toBe("https://example.com/label.jpg");
    expect(enriched.quantity).toBe("1kg");
  });
});

describe("photo enrichment candidate selection", () => {
  it("uses a richer public candidate when photo name and brand match", () => {
    const candidate = selectPhotoEnrichmentCandidate(
      [
        product({
          id: "weak",
          name: "계란과자",
          brand: "다른제조사",
          ingredients: ["밀가루"],
          reportNo: "weak-report",
        }),
        product({
          id: "strong",
          name: "해태 계란과자",
          brand: "해태제과",
          ingredients: ["밀가루", "계란", "탄산수소나트륨"],
          reportNo: "strong-report",
        }),
      ],
      product({ name: "해태 계란과자", brand: "해태", ingredients: ["계란"] }),
    );

    expect(candidate?.id).toBe("strong");
  });

  it("does not choose a candidate when the photo brand conflicts", () => {
    const candidate = selectPhotoEnrichmentCandidate(
      [
        product({
          id: "ingredient-rich",
          name: "계란과자",
          brand: "파리크라상",
          ingredients: ["밀가루", "난백액", "전란액", "탄산수소나트륨"],
          reportNo: "candidate-report",
        }),
      ],
      product({ name: "계란과자", brand: "해태", ingredients: ["계란", "난황액"] }),
    );

    expect(candidate).toBeNull();
  });

  it("does not choose among ambiguous exact-name candidates without a brand", () => {
    const candidate = selectPhotoEnrichmentCandidate(
      [
        product({ id: "a", name: "계란과자", brand: "청우식품", ingredients: ["밀가루"] }),
        product({ id: "b", name: "계란과자", brand: "파리크라상", ingredients: ["전란액"] }),
      ],
      product({ name: "계란과자", ingredients: ["계란"] }),
    );

    expect(candidate).toBeNull();
  });
});

describe("shopping image candidate selection", () => {
  it("matches shopping thumbnails despite public name symbols and manufacturer legal suffixes", () => {
    const candidate = selectShoppingImageCandidate(
      [
        product({
          id: "shin-shopping",
          name: "농심 신라면, 120g, 40개",
          brand: "농심",
          imageUrl: "https://example.com/shin.jpg",
          sources: ["shopping"],
        }),
      ],
      product({ name: "신(辛)라면", brand: "(주)농심" }),
    );

    expect(candidate?.id).toBe("shin-shopping");
  });

  it("uses a matching shopping thumbnail when public image data is absent", () => {
    const candidate = selectShoppingImageCandidate(
      [
        product({
          id: "wrong",
          name: "Plain Bagel",
          brand: "Other",
          imageUrl: "https://example.com/bagel.jpg",
          sources: ["shopping"],
        }),
        product({
          id: "oreo-shopping",
          name: "Oreo Chocolate Sandwich Cookies 100g",
          brand: "Oreo",
          imageUrl: "https://example.com/oreo.jpg",
          sources: ["shopping"],
          shoppingOffer: {
            minPrice: 1000,
            priceText: "1,000 KRW",
            mallName: "Naver",
            link: "https://shopping.example/oreo",
          },
        }),
      ],
      product({ name: "Oreo Chocolate Sandwich Cookies", brand: "Oreo" }),
    );

    expect(candidate?.id).toBe("oreo-shopping");
  });

  it("does not use an unrelated shopping thumbnail", () => {
    const candidate = selectShoppingImageCandidate(
      [
        product({
          id: "bagel",
          name: "Plain Bagel",
          brand: "Other",
          imageUrl: "https://example.com/bagel.jpg",
          sources: ["shopping"],
        }),
      ],
      product({ name: "Oreo Chocolate Sandwich Cookies", brand: "Oreo" }),
    );

    expect(candidate).toBeNull();
  });
});
