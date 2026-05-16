import type { Nutrition, ProductStatus } from "./types";

export type SubmissionIssueCode =
  | "product_image_required"
  | "name_required"
  | "barcode_invalid"
  | "nutrition_evidence_missing"
  | "ingredient_evidence_missing";

export interface SubmissionQualityIssue {
  code: SubmissionIssueCode;
  label: string;
  description: string;
  blocking: boolean;
}

export interface FoodSubmissionDraft {
  name?: string;
  barcode?: string;
  brand?: string;
  quantity?: string;
  productImageCount?: number;
  nutritionImageCount?: number;
  ingredientImageCount?: number;
  nutrition?: Nutrition;
  ingredientsText?: string;
  ingredients?: string[];
}

export interface SubmissionQualityResult {
  canSubmit: boolean;
  score: number;
  confidence: number;
  status: ProductStatus;
  blockingIssues: SubmissionQualityIssue[];
  reviewIssues: SubmissionQualityIssue[];
}

const CORE_NUTRITION_KEYS: (keyof Pick<
  Nutrition,
  "energyKcal" | "sugarsG" | "sodiumMg" | "saturatedFatG"
>)[] = ["energyKcal", "sugarsG", "sodiumMg", "saturatedFatG"];

const issue = (
  code: SubmissionIssueCode,
  label: string,
  description: string,
  blocking: boolean,
): SubmissionQualityIssue => ({
  code,
  label,
  description,
  blocking,
});

const hasText = (value: string | undefined, minLength = 1) =>
  value !== undefined && value.trim().length >= minLength;

const hasPositiveCount = (value: number | undefined) => (value ?? 0) > 0;

const validNutritionValueCount = (nutrition: Nutrition | undefined) =>
  CORE_NUTRITION_KEYS.filter((key) => {
    const value = nutrition?.[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }).length;

export function hasNutritionEvidence(draft: FoodSubmissionDraft) {
  return (
    hasPositiveCount(draft.nutritionImageCount) || validNutritionValueCount(draft.nutrition) >= 3
  );
}

export function hasIngredientEvidence(draft: FoodSubmissionDraft) {
  return (
    hasPositiveCount(draft.ingredientImageCount) ||
    hasText(draft.ingredientsText, 10) ||
    (draft.ingredients?.filter((item) => item.trim()).length ?? 0) >= 3
  );
}

export function evaluateFoodSubmissionDraft(draft: FoodSubmissionDraft): SubmissionQualityResult {
  const blockingIssues: SubmissionQualityIssue[] = [];
  const reviewIssues: SubmissionQualityIssue[] = [];

  const hasProductImage = hasPositiveCount(draft.productImageCount);
  const hasValidName = hasText(draft.name, 2) && (draft.name?.trim().length ?? 0) <= 80;
  const hasBarcode = hasText(draft.barcode);
  const hasValidBarcode = !hasBarcode || /^\d{8,14}$/.test(draft.barcode?.trim() ?? "");
  const nutritionEvidence = hasNutritionEvidence(draft);
  const ingredientEvidence = hasIngredientEvidence(draft);

  if (!hasProductImage) {
    blockingIssues.push(
      issue(
        "product_image_required",
        "제품 사진",
        "제품 전면 사진은 사용자 제보의 기본 근거입니다.",
        true,
      ),
    );
  }
  if (!hasValidName) {
    blockingIssues.push(
      issue("name_required", "제품명", "제품명은 2-80자로 입력해야 합니다.", true),
    );
  }
  if (!hasValidBarcode) {
    blockingIssues.push(
      issue("barcode_invalid", "바코드", "바코드는 입력 시 8-14자리 숫자여야 합니다.", true),
    );
  }
  if (!nutritionEvidence) {
    reviewIssues.push(
      issue(
        "nutrition_evidence_missing",
        "영양 근거",
        "영양성분표 사진 또는 핵심 영양값 3개 이상이 필요합니다.",
        false,
      ),
    );
  }
  if (!ingredientEvidence) {
    reviewIssues.push(
      issue(
        "ingredient_evidence_missing",
        "원재료 근거",
        "원재료 사진 또는 원재료 텍스트가 필요합니다.",
        false,
      ),
    );
  }

  let score = 0;
  if (hasProductImage) score += 20;
  if (hasValidName) score += 15;
  score += hasValidBarcode && hasBarcode ? 10 : 5;
  if (nutritionEvidence) score += 25;
  else if (validNutritionValueCount(draft.nutrition) > 0) score += 5;
  if (ingredientEvidence) score += 25;
  if (hasText(draft.brand) || hasText(draft.quantity)) score += 5;

  score = Math.min(100, score);
  const confidence = Math.round((0.45 + score * 0.0045) * 100) / 100;
  const canSubmit = blockingIssues.length === 0;
  const status: ProductStatus =
    canSubmit && reviewIssues.length === 0 ? "provisional" : "needs_review";

  return {
    canSubmit,
    score,
    confidence,
    status,
    blockingIssues,
    reviewIssues,
  };
}
