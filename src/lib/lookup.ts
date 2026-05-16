import { getProductById } from "./storage";
import { AppEdgeFunctionError } from "./edge-function-client";
import {
  lookupC005,
  lookupI2570,
  lookupI0490,
  enrichProduct,
  lookupOpenFoodFactsByBarcode,
  searchI1250,
  searchOpenFoodFacts,
} from "./public-api";
import {
  applyProductCandidateSelection,
  pickFallbackProductCandidate,
  selectBestProductCandidate,
  type ProductCandidateSource,
  type ProductSelectionCandidate,
} from "./product-selection";
import { translateProductToKoreanIfNeeded } from "./product-translation";
import { lookupVerifiedProduct } from "./supabase-api";
import { isValidBarcode } from "./barcode-utils";
import type { Product } from "./types";

export type LookupStage = "local" | "public_api" | "open_food_facts" | "ai" | "done";
export type StageStatus = "pending" | "running" | "ok" | "skipped" | "fail";

export interface StageState {
  key: LookupStage;
  label: string;
  status: StageStatus;
  message?: string;
}

export const initialStages = (): StageState[] => [
  { key: "local", label: "자체 DB 확인", status: "pending" },
  { key: "public_api", label: "공공데이터 조회", status: "pending" },
  { key: "open_food_facts", label: "공개 DB 조회", status: "pending" },
  { key: "ai", label: "AI 보강", status: "pending" },
];

export interface LookupResult {
  product: Product | null;
  stages: StageState[];
  recallError?: boolean; // 회수 API 실패 여부 (§14.5)
}

export async function lookupBarcode(
  barcode: string,
  onStage?: (stages: StageState[]) => void,
): Promise<LookupResult> {
  const stages = initialStages();
  let recallError = false;
  const candidates: ProductSelectionCandidate[] = [];
  const canQueryBarcodeSources = isValidBarcode(barcode);

  const update = (i: number, status: StageStatus, message?: string) => {
    stages[i] = { ...stages[i], status, message };
    onStage?.([...stages]);
  };

  const addCandidate = (source: ProductCandidateSource, product: Product) => {
    candidates.push({ source, product });
  };

  const attachRecall = async (product: Product): Promise<Product> => {
    try {
      const recallResult = await lookupI0490(
        product.name,
        product.brand,
        product.barcode,
        product.reportNo,
      );
      if (recallResult.error) recallError = true;
      return recallResult.recall ? { ...product, recall: recallResult.recall } : product;
    } catch {
      recallError = true;
      return product;
    }
  };

  update(0, "running");
  let localProduct: Product | null = null;
  if (canQueryBarcodeSources) {
    try {
      const verified = await lookupVerifiedProduct(barcode);
      if (verified) localProduct = await attachRecall(verified);
    } catch {
      // Supabase 설정이 없거나 실패하면 로컬 캐시와 공개 API 조회를 계속한다.
    }
  }

  if (!localProduct) {
    const local = getProductById(barcode);
    if (local) localProduct = await attachRecall(local);
  }

  if (localProduct) {
    addCandidate("local", localProduct);
    update(0, "ok");
  } else {
    update(0, "skipped");
  }

  if (!canQueryBarcodeSources) {
    update(1, "skipped", "바코드 아님");
    update(2, "skipped", "바코드 아님");
    const translation = localProduct
      ? await translateProductToKoreanIfNeeded(localProduct)
      : { product: null, translated: false };
    update(
      3,
      translation.translated ? "ok" : "skipped",
      translation.translated ? "한국어 번역 적용" : "로컬 임시 제품 ID",
    );
    return { product: translation.product, stages, recallError };
  }

  update(1, "running");
  let publicProduct: Product | null = null;
  try {
    publicProduct = await lookupC005(barcode);
    if (!publicProduct) publicProduct = await lookupI2570(barcode);

    if (publicProduct) {
      publicProduct = await enrichProduct(publicProduct);
      publicProduct = await attachRecall(publicProduct);
      addCandidate("public_api", publicProduct);
      update(1, "ok");
    }
  } catch (error) {
    const isLimitExceeded = error instanceof AppEdgeFunctionError && error.status === 429;
    update(
      1,
      "fail",
      isLimitExceeded ? "공공 API 호출 한도 초과 — 잠시 후 다시 시도하세요" : "공공 API 응답 실패",
    );
  }
  if (stages[1].status === "running") {
    update(1, "skipped", "일치 데이터 없음");
  }

  update(2, "running");
  try {
    const off = await lookupOpenFoodFactsByBarcode(barcode);
    if (off) {
      let enrichedOff = off;
      try {
        enrichedOff = await enrichProduct(off);
      } catch {
        enrichedOff = off;
      }
      addCandidate("open_food_facts", await attachRecall(enrichedOff));
      update(2, "ok");
    }
  } catch {
    // 공개 DB 호출 실패는 후보 없음으로 처리한다.
  }
  if (stages[2].status === "running") {
    update(2, "fail", "공개 DB 조회 실패 또는 결과 없음");
  }

  if (candidates.length === 0) {
    update(3, "skipped", "선택할 후보 없음");
    return { product: null, stages, recallError };
  }

  update(3, "running");
  try {
    const selection = await selectBestProductCandidate(barcode, candidates);
    const selectedProduct = applyProductCandidateSelection(candidates, selection);
    const translation = selectedProduct
      ? await translateProductToKoreanIfNeeded(selectedProduct)
      : { product: null, translated: false };
    update(3, "ok", translation.translated ? "한국어 번역 적용" : undefined);
    const product = translation.product;
    return { product, stages, recallError };
  } catch {
    const fallback = pickFallbackProductCandidate(candidates)?.product ?? null;
    const translation = fallback
      ? await translateProductToKoreanIfNeeded(fallback)
      : { product: null, translated: false };
    update(3, "fail", "Gemini 선택 실패, 우선순위 후보 사용");
    return { product: translation.product, stages, recallError };
  }
}

export async function lookupSearch(q: string): Promise<Product[]> {
  const results: Product[] = [];

  // 1. 식약처 I1250 검색
  try {
    const publicResults = await searchI1250(q);
    results.push(...publicResults);
  } catch {
    // 공공 API 실패 시 무시, OFF로 계속
  }

  // 2. Open Food Facts 검색
  try {
    const offResults = await searchOpenFoodFacts(q);
    // 중복 제거 (이름+브랜드 기준)
    for (const p of offResults) {
      const isDuplicate = results.some((r) => r.name === p.name && r.brand === p.brand);
      if (!isDuplicate) results.push(p);
    }
  } catch {
    // OFF 실패 시 무시
  }

  return results.slice(0, 20);
}
