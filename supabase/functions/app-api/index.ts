import {
  getAccountSnapshotInternal,
  signInAccountInternal,
  signOutAccountInternal,
  syncAccountSnapshotInternal,
} from "./actions/account-sync.ts";
import {
  HttpError,
  assertObject,
  assertProduct,
  assertProductSelectionCandidates,
  corsHeaders,
  jsonResponse,
  optionalString,
  requiredString,
} from "./_shared/runtime.ts";
import { isAdminAccessGranted, assertAdminAccess } from "./actions/admin.ts";
import {
  assertAdditiveExplanationTerms,
  explainAdditiveTermsInternal,
} from "./actions/additive-explanations.ts";
import {
  assertAlternativeFitProducts,
  judgeAlternativeFitInternal,
} from "./actions/alternative-fit.ts";
import {
  assertGeminiAlternativeRecommendationProducts,
  assertGeminiAlternativeShoppingProducts,
  assertGeminiAlternativeShoppingSearch,
  recommendAlternativeShoppingSearchesInternal,
  recommendAlternativeProductsInternal,
  verifyAlternativeShoppingResultsInternal,
} from "./actions/alternative-recommendations.ts";
import { searchAlternativeCandidatesInternal } from "./actions/alternatives.ts";
import {
  lookupOpenFoodFactsByBarcodeInternal,
  searchNaverShoppingInternal,
  searchOpenFoodFactsInternal,
} from "./actions/catalog-search.ts";
import { enrichProductInternal } from "./actions/enrichment.ts";
import { recommendFoodPairingsInternal } from "./actions/food-pairings.ts";
import { lookupAdditiveInfoInternal, lookupIngredientInfoInternal } from "./actions/ingredients.ts";
import { lookupNutritionStandardInternal } from "./actions/nutrition.ts";
import {
  analyzeFoodImageInternal,
  asNumber,
  validateOcrInput,
  selectBestProductCandidateInternal,
} from "./actions/ocr.ts";
import { translateProductToKoreanInternal } from "./actions/translation.ts";
import {
  lookupC002Internal,
  lookupC005Internal,
  lookupI2570Internal,
  searchI1250Internal,
} from "./actions/product-lookup.ts";
import { lookupVerifiedProductInternal, upsertProductInternal } from "./actions/product-store.ts";
import { lookupI0490Internal } from "./actions/recall.ts";
import {
  approveReviewItemInternal,
  enqueueAdditiveReviewInternal,
  enqueueReviewInternal,
  listReviewQueueInternal,
  updateReviewStatusInternal,
} from "./actions/review-queue.ts";
import type { ReviewQueueListStatus, ReviewReason, ReviewStatus } from "./_shared/types.ts";

declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const runAction = async (action: string, payload: unknown): Promise<unknown> => {
  const data = assertObject(payload ?? {});

  switch (action) {
    case "lookupC005":
      return lookupC005Internal(requiredString(data, "barcode"));
    case "lookupI2570":
      return lookupI2570Internal(requiredString(data, "barcode"));
    case "lookupC002":
      return lookupC002Internal(requiredString(data, "reportNo"));
    case "searchI1250":
      return searchI1250Internal(requiredString(data, "query"));
    case "lookupNutritionStandard":
      return lookupNutritionStandardInternal(
        requiredString(data, "productName"),
        optionalString(data, "brand"),
        optionalString(data, "reportNo"),
      );
    case "lookupIngredientInfo":
      return lookupIngredientInfoInternal(requiredString(data, "ingredientName"));
    case "lookupAdditiveInfo":
      return lookupAdditiveInfoInternal(requiredString(data, "additiveName"));
    case "explainAdditiveTerms":
      return explainAdditiveTermsInternal(assertAdditiveExplanationTerms(data.terms));
    case "searchOpenFoodFacts":
      return searchOpenFoodFactsInternal(requiredString(data, "query"));
    case "lookupOpenFoodFactsByBarcode":
      return lookupOpenFoodFactsByBarcodeInternal(requiredString(data, "barcode"));
    case "searchNaverShopping":
      return searchNaverShoppingInternal(requiredString(data, "query"));
    case "searchAlternativeCandidates":
      return searchAlternativeCandidatesInternal(
        assertProduct(data.product),
        asNumber(data.limit) ?? 20,
      );
    case "judgeAlternativeFit":
      return judgeAlternativeFitInternal(
        assertProduct(data.product),
        assertAlternativeFitProducts(data.candidates),
      );
    case "recommendAlternativeProducts":
      return recommendAlternativeProductsInternal(
        assertProduct(data.product),
        assertGeminiAlternativeRecommendationProducts(data.candidates),
      );
    case "recommendAlternativeShoppingSearches":
      return recommendAlternativeShoppingSearchesInternal(assertProduct(data.product));
    case "verifyAlternativeShoppingResults":
      return verifyAlternativeShoppingResultsInternal(
        assertProduct(data.product),
        assertGeminiAlternativeShoppingSearch(data.search),
        assertGeminiAlternativeShoppingProducts(data.candidates),
      );
    case "recommendFoodPairings":
      return recommendFoodPairingsInternal(assertProduct(data.product));
    case "lookupI0490":
      return lookupI0490Internal({
        productName: requiredString(data, "productName"),
        brand: optionalString(data, "brand"),
        barcode: optionalString(data, "barcode"),
        reportNo: optionalString(data, "reportNo"),
      });
    case "enrichProduct":
      return enrichProductInternal(assertProduct(data.product));
    case "selectBestProductCandidate":
      return selectBestProductCandidateInternal(
        requiredString(data, "barcode"),
        assertProductSelectionCandidates(data.candidates),
      );
    case "analyzeFoodImage":
      return analyzeFoodImageInternal(validateOcrInput(data));
    case "translateProductToKorean":
      return translateProductToKoreanInternal(assertProduct(data.product));
    case "lookupVerifiedProduct":
      return lookupVerifiedProductInternal(requiredString(data, "idOrBarcode"));
    case "upsertProduct":
      return upsertProductInternal(assertProduct(data.product));
    case "enqueueReview":
      return enqueueReviewInternal(
        assertProduct(data.product),
        requiredString(data, "reason") as ReviewReason,
        data.rawPayload ?? null,
      );
    case "enqueueAdditiveReview":
      return enqueueAdditiveReviewInternal(
        requiredString(data, "additiveName"),
        optionalString(data, "productId"),
      );
    case "verifyAdminAccess":
      return isAdminAccessGranted(requiredString(data, "adminCode"));
    case "signInAccount":
      return signInAccountInternal(requiredString(data, "username"), requiredString(data, "pin"));
    case "getAccountSnapshot":
      return getAccountSnapshotInternal(requiredString(data, "token"), optionalString(data, "userId"));
    case "syncAccountSnapshot":
      return syncAccountSnapshotInternal(
        requiredString(data, "token"),
        data.snapshot,
        optionalString(data, "userId"),
      );
    case "signOutAccount":
      return signOutAccountInternal(requiredString(data, "token"));
    case "listReviewQueue":
      assertAdminAccess(requiredString(data, "adminCode"));
      return listReviewQueueInternal(
        (optionalString(data, "status") ?? "pending") as ReviewQueueListStatus,
      );
    case "updateReviewStatus":
      assertAdminAccess(requiredString(data, "adminCode"));
      return updateReviewStatusInternal(
        requiredString(data, "id"),
        requiredString(data, "status") as ReviewStatus,
        optionalString(data, "note"),
      );
    case "approveReviewItem":
      assertAdminAccess(requiredString(data, "adminCode"));
      return approveReviewItemInternal(requiredString(data, "id"), assertProduct(data.product));
    default:
      throw new HttpError(`Unknown action: ${action}`, 404, "UNKNOWN_ACTION");
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: { message: "Method not allowed", code: "METHOD_NOT_ALLOWED" } },
      405,
    );
  }

  try {
    const body = assertObject(await request.json());
    const action = requiredString(body, "action");
    const data = await runAction(action, body.payload ?? {});
    return jsonResponse({ data });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: { message: error.message, code: error.code } }, error.status);
    }
    console.error(error);
    return jsonResponse(
      {
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
          code: "INTERNAL_ERROR",
        },
      },
      500,
    );
  }
});
