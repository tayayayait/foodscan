import { describe, expect, it } from "vitest";
import type { Product } from "./types";
import { reviewReasonForProduct, shouldSendToReview } from "./review-policy";

const product = (overrides: Partial<Product>): Product => ({
  id: "p1",
  name: "제품",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: {},
  sources: ["user_submitted"],
  status: "provisional",
  confidence: 0.9,
  updatedAt: "2026-05-12T09:00:00.000Z",
  ...overrides,
});

describe("review policy", () => {
  it("queues low-confidence OCR products before generic user submissions", () => {
    const p = product({
      sources: ["ai_estimated", "user_submitted"],
      confidence: 0.61,
      status: "needs_review",
    });

    expect(shouldSendToReview(p)).toBe(true);
    expect(reviewReasonForProduct(p)).toBe("ocr_low_confidence");
  });

  it("queues user-submitted provisional products", () => {
    const p = product({ sources: ["user_submitted"], confidence: 0.86 });

    expect(shouldSendToReview(p)).toBe(true);
    expect(reviewReasonForProduct(p)).toBe("user_submitted");
  });

  it("queues matched products when an additive cannot be classified", () => {
    const p = product({
      sources: ["public_api"],
      status: "public_matched",
      additives: ["custom additive"],
      confidence: 0.91,
    });

    expect(shouldSendToReview(p)).toBe(true);
    expect(reviewReasonForProduct(p)).toBe("unknown_additive");
  });

  it("does not queue verified products", () => {
    const p = product({
      sources: ["verified"],
      status: "verified",
      confidence: 1,
    });

    expect(shouldSendToReview(p)).toBe(false);
    expect(reviewReasonForProduct(p)).toBe(null);
  });
});
