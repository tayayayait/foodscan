import { requestSupabase } from "../_shared/supabase-rest.ts";
import { upsertProductInternal } from "./product-store.ts";
import type {
  Product,
  ReviewQueueItem,
  ReviewQueueListStatus,
  ReviewQueueRow,
  ReviewReason,
  ReviewStatus,
} from "../_shared/types.ts";

export const collectRiskFlags = (product: Product): string[] => {
  const flags = new Set<string>();
  if (product.recall) flags.add("recall");
  if (product.allergens.length > 0) flags.add("allergy");
  if (product.confidence < 0.7) flags.add("low_confidence");
  if (Object.keys(product.nutrition).length === 0) flags.add("nutrition_missing");
  return [...flags];
};

export const buildReviewQueueInsert = (
  product: Product,
  reason: ReviewReason,
  rawPayload: unknown = null,
) => ({
  product_id: product.id,
  product_snapshot: product,
  raw_payload: rawPayload,
  reason,
  status: "pending",
  confidence: product.confidence,
  risk_flags: collectRiskFlags(product),
});

export const REASON_LABELS: Record<ReviewReason, string> = {
  ocr_low_confidence: "OCR 신뢰도 낮음",
  user_submitted: "사용자 제보",
  ambiguous_match: "후보 다중 매칭",
  unknown_additive: "미분류 첨가물",
  api_enrichment_failed: "API 보강 실패",
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "미검수",
  in_review: "검수 중",
  approved: "승인됨",
  rejected: "반려",
};

export const RISK_LABELS: Record<string, string> = {
  recall: "회수 의심",
  allergy: "알레르기 의심",
  low_confidence: "신뢰도 낮음",
  nutrition_missing: "영양정보 부족",
  unknown_additive: "미분류 첨가물",
};

export const reviewQueueItemFromRow = (row: ReviewQueueRow): ReviewQueueItem => ({
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
});

export const buildReviewQueueListParams = (status: ReviewQueueListStatus = "pending") => ({
  select: "*",
  ...(status === "all" ? {} : { status: `eq.${status}` }),
  order: "created_at.desc",
  limit: "50",
});

export const buildReviewStatusPatch = (status: ReviewStatus, note?: string) => ({
  status,
  ...(note?.trim() ? { raw_payload: { note: note.trim() } } : {}),
});

export const buildApprovedProduct = (product: Product): Product => ({
  ...product,
  status: "verified",
  sources: ["verified", ...product.sources.filter((source) => source !== "verified")],
  confidence: 1,
  updatedAt: new Date().toISOString(),
});

export const enqueueReviewInternal = async (
  product: Product,
  reason: ReviewReason,
  rawPayload: unknown,
): Promise<boolean> => {
  const rows = await requestSupabase<unknown[]>("review_queue", {
    method: "POST",
    body: JSON.stringify(buildReviewQueueInsert(product, reason, rawPayload)),
    prefer: "return=representation",
  });
  return Boolean(rows);
};

export const enqueueAdditiveReviewInternal = async (
  additiveName: string,
  productId?: string,
): Promise<boolean> => {
  const rows = await requestSupabase<unknown[]>("additive_review_queue", {
    method: "POST",
    body: JSON.stringify({
      additive_name: additiveName,
      product_id: productId || null,
      status: "pending",
    }),
    prefer: "return=representation",
  });
  return Boolean(rows);
};

export const listReviewQueueInternal = async (
  status: ReviewQueueListStatus = "pending",
): Promise<ReviewQueueItem[]> => {
  const rows = await requestSupabase<ReviewQueueRow[]>("review_queue", {
    method: "GET",
    params: buildReviewQueueListParams(status),
  });
  return (rows ?? []).map(reviewQueueItemFromRow);
};

export const updateReviewStatusInternal = async (
  id: string,
  status: ReviewStatus,
  note?: string,
): Promise<boolean> => {
  const rows = await requestSupabase<ReviewQueueRow[]>("review_queue", {
    method: "PATCH",
    params: { id: `eq.${id}` },
    body: JSON.stringify(buildReviewStatusPatch(status, note)),
    prefer: "return=representation",
  });
  return Boolean(rows);
};

export const approveReviewItemInternal = async (id: string, product: Product): Promise<boolean> => {
  const approvedProduct = buildApprovedProduct(product);
  const productSaved = await upsertProductInternal(approvedProduct);
  if (!productSaved) return false;
  return updateReviewStatusInternal(id, "approved");
};
