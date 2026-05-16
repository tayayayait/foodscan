import { describe, expect, it } from "vitest";
import { evaluateFoodSubmissionDraft } from "./submission-quality";

describe("food submission quality", () => {
  it("blocks submission when identity or required product evidence is missing", () => {
    const result = evaluateFoodSubmissionDraft({
      name: "A",
      barcode: "abc",
      productImageCount: 0,
      nutrition: {},
      ingredientsText: "",
      nutritionImageCount: 0,
      ingredientImageCount: 0,
    });

    expect(result.canSubmit).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toEqual([
      "product_image_required",
      "name_required",
      "barcode_invalid",
    ]);
    expect(result.status).toBe("needs_review");
  });

  it("marks submissions without nutrition or ingredient evidence for review", () => {
    const result = evaluateFoodSubmissionDraft({
      name: "검증 제품",
      barcode: "8801234567890",
      productImageCount: 1,
      nutrition: { sugarsG: 12 },
      ingredientsText: "",
      nutritionImageCount: 0,
      ingredientImageCount: 0,
    });

    expect(result.canSubmit).toBe(true);
    expect(result.reviewIssues.map((issue) => issue.code)).toEqual([
      "nutrition_evidence_missing",
      "ingredient_evidence_missing",
    ]);
    expect(result.status).toBe("needs_review");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("treats complete nutrition values and ingredient text as score-ready evidence", () => {
    const result = evaluateFoodSubmissionDraft({
      name: "검증 제품",
      barcode: "8801234567890",
      brand: "식품회사",
      quantity: "80g",
      productImageCount: 1,
      nutrition: {
        energyKcal: 180,
        sugarsG: 8,
        sodiumMg: 420,
        saturatedFatG: 2,
      },
      ingredientsText: "밀가루, 정제수, 설탕, 정제염",
      nutritionImageCount: 0,
      ingredientImageCount: 0,
    });

    expect(result.canSubmit).toBe(true);
    expect(result.reviewIssues).toEqual([]);
    expect(result.status).toBe("provisional");
    expect(result.score).toBe(100);
    expect(result.confidence).toBe(0.9);
  });

  it("accepts evidence images when text values are incomplete", () => {
    const result = evaluateFoodSubmissionDraft({
      name: "검증 제품",
      productImageCount: 1,
      nutrition: {},
      ingredientsText: "",
      nutritionImageCount: 1,
      ingredientImageCount: 1,
    });

    expect(result.canSubmit).toBe(true);
    expect(result.reviewIssues).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(75);
  });
});
