import { describe, expect, it } from "vitest";
import type { Product } from "./types";
import {
  buildReviewQueueInsert,
  productFromSupabaseRow,
  productToSupabaseRow,
} from "./supabase-mappers";

const sampleProduct: Product = {
  id: "8801234567890",
  barcode: "8801234567890",
  reportNo: "RPT-1",
  name: "Sample snack",
  brand: "Sample Food",
  category: "Snack",
  imageUrl: "https://example.com/a.jpg",
  submittedImageUrls: {
    product: "data:image/jpeg;base64,abc",
  },
  quantity: "80g",
  ingredientsText: "wheat flour, sugar, aspartame",
  ingredients: ["wheat flour", "sugar", "aspartame"],
  allergens: ["wheat"],
  additives: ["aspartame"],
  nutrition: {
    energyKcal: 420,
    sugarsG: 18,
    sodiumMg: 360,
    saturatedFatG: 3.2,
    proteinG: 6,
    servingSize: "40g",
  },
  sources: ["ai_estimated", "user_submitted"],
  status: "needs_review",
  confidence: 0.62,
  recall: {
    reason: "sample recall",
    company: "Sample Food",
    date: "2026-05-12",
  },
  updatedAt: "2026-05-12T09:00:00.000Z",
};

describe("supabase product mappers", () => {
  it("round-trips Product through the Supabase row shape", () => {
    const row = productToSupabaseRow(sampleProduct);
    const product = productFromSupabaseRow(row);

    expect(row.id).toBe(sampleProduct.id);
    expect(row.barcode).toBe(sampleProduct.barcode);
    expect(row.report_no).toBe(sampleProduct.reportNo);
    expect(row.image_url).toBe(sampleProduct.imageUrl);
    expect(row.submitted_image_urls).toEqual(sampleProduct.submittedImageUrls);
    expect(product).toEqual(sampleProduct);
  });

  it("builds a pending review queue row with confidence and risk flags", () => {
    const insert = buildReviewQueueInsert(sampleProduct, "ocr_low_confidence", {
      warnings: ["blurry image"],
    });

    expect(insert.product_id).toBe(sampleProduct.id);
    expect(insert.reason).toBe("ocr_low_confidence");
    expect(insert.status).toBe("pending");
    expect(insert.confidence).toBe(0.62);
    expect(insert.risk_flags).toEqual(["recall", "allergy", "low_confidence"]);
    expect(insert.product_snapshot).toEqual(sampleProduct);
    expect(insert.raw_payload).toEqual({ warnings: ["blurry image"] });
  });

  it("adds an unknown_additive risk flag when additive classification needs review", () => {
    const insert = buildReviewQueueInsert(
      {
        ...sampleProduct,
        recall: undefined,
        allergens: [],
        additives: ["custom additive"],
        confidence: 0.91,
      },
      "unknown_additive",
    );

    expect(insert.risk_flags).toEqual(["unknown_additive"]);
  });
});
