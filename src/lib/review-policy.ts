import type { Product } from "./types";
import type { ReviewReason } from "./supabase-mappers";
import { getUnknownAdditives } from "./additive-dictionary";

export function reviewReasonForProduct(product: Product): ReviewReason | null {
  if (product.status === "verified") return null;
  if (product.sources.includes("ai_estimated") && product.confidence < 0.7) {
    return "ocr_low_confidence";
  }
  if (product.sources.includes("user_submitted")) {
    return "user_submitted";
  }
  if (getUnknownAdditives(product.additives).length > 0) {
    return "unknown_additive";
  }
  if (product.status === "needs_review") {
    return "ambiguous_match";
  }
  return null;
}

export function shouldSendToReview(product: Product): boolean {
  return reviewReasonForProduct(product) !== null;
}
