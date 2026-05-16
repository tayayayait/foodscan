import { describe, expect, it } from "vitest";
import type { Product } from "./types";
import {
  applyReviewProductDraft,
  buildApprovedProduct,
  buildReviewQueueListParams,
  buildReviewStatusPatch,
  filterAndSortReviewQueueItems,
  reviewApprovalCheck,
  reviewProductDraftFromProduct,
  reviewQueueItemFromRow,
  reviewQueuePriorityOf,
  type ReviewQueueRow,
} from "./review-queue";

const product: Product = {
  id: "p1",
  barcode: "8801234567890",
  name: "검수 제품",
  brand: "제조사",
  ingredients: ["밀"],
  allergens: ["밀"],
  additives: [],
  nutrition: {},
  sources: ["user_submitted"],
  status: "provisional",
  confidence: 0.54,
  updatedAt: "2026-05-12T09:00:00.000Z",
};

const row: ReviewQueueRow = {
  id: "queue-1",
  product_id: "p1",
  product_snapshot: product,
  raw_payload: { warning: "low confidence" },
  reason: "ocr_low_confidence",
  status: "pending",
  confidence: 0.54,
  risk_flags: ["allergy", "low_confidence", "unknown_additive"],
  created_at: "2026-05-12T10:00:00.000Z",
  updated_at: "2026-05-12T10:00:00.000Z",
};

describe("review queue helpers", () => {
  it("normalizes a review queue row for the admin UI", () => {
    const item = reviewQueueItemFromRow(row);

    expect(item.id).toBe("queue-1");
    expect(item.product.id).toBe("p1");
    expect(item.reasonLabel).toBe("OCR 신뢰도 낮음");
    expect(item.statusLabel).toBe("미검수");
    expect(item.riskLabels).toEqual(["알레르기 의심", "신뢰도 낮음", "미분류 첨가물"]);
  });

  it("builds status patches with optional rejection note", () => {
    expect(buildReviewStatusPatch("approved")).toEqual({ status: "approved" });
    expect(buildReviewStatusPatch("rejected", "중복")).toEqual({
      status: "rejected",
      raw_payload: { note: "중복" },
    });
  });

  it("builds list query params with status filtering", () => {
    expect(buildReviewQueueListParams("pending")).toEqual({
      select: "*",
      status: "eq.pending",
      order: "created_at.desc",
      limit: "50",
    });
    expect(buildReviewQueueListParams("all")).toEqual({
      select: "*",
      order: "created_at.desc",
      limit: "50",
    });
  });

  it("filters and sorts review items for admin triage", () => {
    const first = reviewQueueItemFromRow(row);
    const second = reviewQueueItemFromRow({
      ...row,
      id: "queue-2",
      product_id: "p2",
      product_snapshot: {
        ...product,
        id: "p2",
        sources: ["public_api"],
        confidence: 0.92,
      },
      confidence: 0.92,
      risk_flags: ["nutrition_missing"],
      created_at: "2026-05-01T10:00:00.000Z",
    });

    const result = filterAndSortReviewQueueItems(
      [second, first],
      {
        source: "user_submitted",
        risk: "low_confidence",
        sort: "confidence_asc",
        date: "30d",
      },
      new Date("2026-05-13T00:00:00.000Z"),
    );

    expect(result.map((item) => item.id)).toEqual(["queue-1"]);
    expect(reviewQueuePriorityOf(first)).toBeGreaterThan(reviewQueuePriorityOf(second));
  });

  it("checks approval requirements before marking a product verified", () => {
    expect(reviewApprovalCheck(product)).toEqual({ ok: true, reasons: [] });

    expect(
      reviewApprovalCheck({
        ...product,
        name: "",
        barcode: "12",
        brand: undefined,
        sources: [],
        ingredients: [],
        nutrition: {},
      }),
    ).toEqual({
      ok: false,
      reasons: [
        "제품명이 필요합니다.",
        "제조사 또는 출처가 필요합니다.",
        "바코드는 8-14자리 숫자여야 합니다.",
        "원재료 또는 영양성분 중 하나 이상이 필요합니다.",
      ],
    });
  });

  it("applies reviewer edits before approval", () => {
    const draft = reviewProductDraftFromProduct(product);
    const edited = applyReviewProductDraft(product, {
      ...draft,
      name: "수정 제품",
      brand: "수정 제조사",
      ingredientsText: "밀, 설탕, E330",
    });

    expect(edited.name).toBe("수정 제품");
    expect(edited.brand).toBe("수정 제조사");
    expect(edited.ingredients).toEqual(["밀", "설탕", "E330"]);
  });

  it("marks approved products as verified", () => {
    const approved = buildApprovedProduct(product);

    expect(approved.status).toBe("verified");
    expect(approved.sources).toEqual(["verified", "user_submitted"]);
    expect(approved.confidence).toBe(1);
  });
});
