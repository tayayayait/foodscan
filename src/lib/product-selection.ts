import { callAppEdgeFunction } from "./edge-function-client";
import type { Product } from "./types";

export type ProductCandidateSource = "local" | "public_api" | "open_food_facts";

export interface ProductSelectionCandidate {
  source: ProductCandidateSource;
  product: Product;
}

export interface ProductCandidateSelection {
  selectedIndex: number;
  confidence: number;
  reason: string;
  warnings: string[];
}

const SOURCE_PRIORITY: Record<ProductCandidateSource, number> = {
  local: 0,
  public_api: 1,
  open_food_facts: 2,
};

function productTrustRank(candidate: ProductSelectionCandidate) {
  const { product } = candidate;
  if (product.status === "verified" || product.sources.includes("verified")) return 0;
  if (product.status === "public_matched" || product.sources.includes("public_api")) return 1;
  if (product.status === "open_db_matched" || product.sources.includes("open_db")) return 2;
  if (product.sources.includes("ai_estimated") || product.status === "provisional") return 3;
  return SOURCE_PRIORITY[candidate.source] ?? 4;
}

function completenessScore(product: Product) {
  let score = 0;
  if (product.barcode) score += 2;
  if (product.reportNo) score += 2;
  if (product.brand) score += 1;
  if (product.category) score += 1;
  if (product.quantity) score += 1;
  if (product.ingredientsText || product.ingredients.length > 0) score += 2;
  if (Object.values(product.nutrition).some((value) => value !== undefined)) score += 2;
  if (product.imageUrl) score += 1;
  return score;
}

export function pickFallbackProductCandidate(candidates: ProductSelectionCandidate[]) {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      const trustDelta = productTrustRank(a.candidate) - productTrustRank(b.candidate);
      if (trustDelta !== 0) return trustDelta;

      const completenessDelta =
        completenessScore(b.candidate.product) - completenessScore(a.candidate.product);
      if (completenessDelta !== 0) return completenessDelta;

      const confidenceDelta = b.candidate.product.confidence - a.candidate.product.confidence;
      if (confidenceDelta !== 0) return confidenceDelta;

      return a.index - b.index;
    })[0]?.candidate;
}

export function applyProductCandidateSelection(
  candidates: ProductSelectionCandidate[],
  selection: ProductCandidateSelection | null,
) {
  if (candidates.length === 0) return null;
  const selectedIndex = selection?.selectedIndex;
  if (
    typeof selectedIndex === "number" &&
    Number.isInteger(selectedIndex) &&
    candidates[selectedIndex]
  ) {
    return candidates[selectedIndex].product;
  }
  return pickFallbackProductCandidate(candidates)?.product ?? null;
}

export const selectBestProductCandidate = (
  barcode: string,
  candidates: ProductSelectionCandidate[],
) =>
  callAppEdgeFunction<ProductCandidateSelection>("selectBestProductCandidate", {
    barcode,
    candidates,
  });
