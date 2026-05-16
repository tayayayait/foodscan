import type { Product } from "./types";
import type { SourceTag } from "./types";
import type { ReviewReason } from "./supabase-mappers";

export type ReviewStatus = "pending" | "in_review" | "approved" | "rejected";
export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ReviewQueueRow {
  id: string;
  product_id: string;
  product_snapshot: Product;
  raw_payload: JsonValue | null;
  reason: ReviewReason;
  status: ReviewStatus;
  confidence: number;
  risk_flags: string[];
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueItem {
  id: string;
  productId: string;
  product: Product;
  rawPayload: JsonValue | null;
  reason: ReviewReason;
  reasonLabel: string;
  status: ReviewStatus;
  statusLabel: string;
  confidence: number;
  riskFlags: string[];
  riskLabels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStatusPatch {
  status: ReviewStatus;
  raw_payload?: JsonValue;
}

export type ReviewQueueListStatus = ReviewStatus | "all";
export type ReviewQueueSourceFilter = SourceTag | "all";
export type ReviewQueueRiskFilter =
  | "all"
  | "recall"
  | "allergy"
  | "low_confidence"
  | "nutrition_missing"
  | "unknown_additive";
export type ReviewQueueSort =
  | "priority_desc"
  | "created_desc"
  | "confidence_asc"
  | "confidence_desc";
export type ReviewQueueDateFilter = "all" | "today" | "7d" | "30d";

export interface ReviewQueueFilters {
  source: ReviewQueueSourceFilter;
  risk: ReviewQueueRiskFilter;
  sort: ReviewQueueSort;
  date: ReviewQueueDateFilter;
}

export interface ReviewProductDraft {
  name: string;
  brand: string;
  category: string;
  quantity: string;
  barcode: string;
  ingredientsText: string;
}

export const DEFAULT_REVIEW_QUEUE_FILTERS: ReviewQueueFilters = {
  source: "all",
  risk: "all",
  sort: "priority_desc",
  date: "all",
};

const REASON_LABELS: Record<ReviewReason, string> = {
  ocr_low_confidence: "OCR 신뢰도 낮음",
  user_submitted: "사용자 제보",
  ambiguous_match: "후보 다중 매칭",
  unknown_additive: "미분류 첨가물",
  api_enrichment_failed: "API 보강 실패",
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "미검수",
  in_review: "검수 중",
  approved: "승인됨",
  rejected: "반려",
};

const RISK_LABELS: Record<string, string> = {
  recall: "회수 의심",
  allergy: "알레르기 의심",
  low_confidence: "신뢰도 낮음",
  nutrition_missing: "영양정보 부족",
  unknown_additive: "미분류 첨가물",
};

const RISK_PRIORITY: Record<string, number> = {
  recall: 100,
  allergy: 80,
  low_confidence: 70,
  unknown_additive: 55,
  nutrition_missing: 45,
};

export function reviewQueueItemFromRow(row: ReviewQueueRow): ReviewQueueItem {
  return {
    id: row.id,
    productId: row.product_id,
    product: row.product_snapshot,
    rawPayload: row.raw_payload,
    reason: row.reason,
    reasonLabel: REASON_LABELS[row.reason] ?? row.reason,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    confidence: row.confidence,
    riskFlags: row.risk_flags ?? [],
    riskLabels: (row.risk_flags ?? []).map((flag) => RISK_LABELS[flag] ?? flag),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildReviewStatusPatch(status: ReviewStatus, note?: string): ReviewStatusPatch {
  return {
    status,
    ...(note?.trim() ? { raw_payload: { note: note.trim() } } : {}),
  };
}

export function buildReviewQueueListParams(status: ReviewQueueListStatus = "pending") {
  return {
    select: "*",
    ...(status === "all" ? {} : { status: `eq.${status}` }),
    order: "created_at.desc",
    limit: "50",
  };
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateThreshold(filter: ReviewQueueDateFilter, now: Date) {
  if (filter === "all") return null;
  if (filter === "today") return startOfLocalDay(now);
  const days = filter === "7d" ? 7 : 30;
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - days);
  return threshold;
}

export function reviewQueuePriorityOf(item: ReviewQueueItem): number {
  const riskPriority = item.riskFlags.reduce(
    (highest, flag) => Math.max(highest, RISK_PRIORITY[flag] ?? 0),
    0,
  );
  const statusBoost = item.status === "pending" ? 5 : item.status === "in_review" ? 2 : 0;
  const confidenceBoost = item.confidence < 0.7 ? 10 : 0;
  return riskPriority + statusBoost + confidenceBoost;
}

export function filterAndSortReviewQueueItems(
  items: ReviewQueueItem[],
  filters: ReviewQueueFilters = DEFAULT_REVIEW_QUEUE_FILTERS,
  now = new Date(),
) {
  const threshold = dateThreshold(filters.date, now);
  const filtered = items.filter((item) => {
    const sourceMatches = filters.source === "all" || item.product.sources.includes(filters.source);
    const riskMatches = filters.risk === "all" || item.riskFlags.includes(filters.risk);
    const dateMatches = !threshold || new Date(item.createdAt) >= threshold;
    return sourceMatches && riskMatches && dateMatches;
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "confidence_asc") return a.confidence - b.confidence;
    if (filters.sort === "confidence_desc") return b.confidence - a.confidence;
    if (filters.sort === "created_desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const priorityDiff = reviewQueuePriorityOf(b) - reviewQueuePriorityOf(a);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const hasNutritionData = (product: Product) =>
  Object.values(product.nutrition ?? {}).some((value) => value !== undefined && value !== "");

export function reviewApprovalCheck(product: Product) {
  const reasons: string[] = [];
  if (!product.name.trim()) reasons.push("제품명이 필요합니다.");
  if (!product.brand?.trim() && product.sources.length === 0) {
    reasons.push("제조사 또는 출처가 필요합니다.");
  }
  if (product.barcode && !/^\d{8,14}$/.test(product.barcode)) {
    reasons.push("바코드는 8-14자리 숫자여야 합니다.");
  }
  if (
    product.ingredients.length === 0 &&
    !product.ingredientsText?.trim() &&
    !hasNutritionData(product)
  ) {
    reasons.push("원재료 또는 영양성분 중 하나 이상이 필요합니다.");
  }
  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function reviewProductDraftFromProduct(product: Product): ReviewProductDraft {
  return {
    name: product.name,
    brand: product.brand ?? "",
    category: product.category ?? "",
    quantity: product.quantity ?? "",
    barcode: product.barcode ?? "",
    ingredientsText: product.ingredientsText ?? product.ingredients.join(", "),
  };
}

const splitIngredients = (value: string) =>
  value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function applyReviewProductDraft(product: Product, draft: ReviewProductDraft): Product {
  const ingredients = splitIngredients(draft.ingredientsText);
  return {
    ...product,
    name: draft.name.trim(),
    brand: draft.brand.trim() || undefined,
    category: draft.category.trim() || undefined,
    quantity: draft.quantity.trim() || undefined,
    barcode: draft.barcode.trim() || undefined,
    ingredientsText: draft.ingredientsText.trim() || undefined,
    ingredients: ingredients.length > 0 ? ingredients : product.ingredients,
    updatedAt: new Date().toISOString(),
  };
}

export function buildApprovedProduct(product: Product): Product {
  return {
    ...product,
    status: "verified",
    sources: ["verified", ...product.sources.filter((source) => source !== "verified")],
    confidence: 1,
    updatedAt: new Date().toISOString(),
  };
}
