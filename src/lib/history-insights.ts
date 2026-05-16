import { computeScore } from "./score";
import type { Grade, Product, Severity, UserPreferences } from "./types";

export type HistoryConcernKey =
  | "recall"
  | "reviewNeeded"
  | "personalWarning"
  | "highRiskAdditive"
  | "sugar"
  | "sodium"
  | "saturatedFat";

export interface HistoryConcernSummary {
  key: HistoryConcernKey;
  label: string;
  count: number;
  severity: Severity;
  action: string;
}

export interface HistoryInsights {
  totalCount: number;
  scoredCount: number;
  reviewNeededCount: number;
  averageScore: number | null;
  gradeCounts: Record<Grade, number>;
  concerns: Record<HistoryConcernKey, number>;
  topConcern: HistoryConcernSummary | null;
}

export interface AttentionProduct {
  product: Product;
  reasons: string[];
}

const emptyGradeCounts = (): Record<Grade, number> => ({
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
});

const emptyConcerns = (): Record<HistoryConcernKey, number> => ({
  recall: 0,
  reviewNeeded: 0,
  personalWarning: 0,
  highRiskAdditive: 0,
  sugar: 0,
  sodium: 0,
  saturatedFat: 0,
});

const CONCERN_META: Record<
  HistoryConcernKey,
  { label: string; severity: Severity; action: string; priority: number }
> = {
  recall: {
    label: "회수 이력",
    severity: "danger",
    action: "회수 이력이 있는 제품은 섭취 전 공지와 판매중지 여부를 먼저 확인하세요.",
    priority: 6,
  },
  reviewNeeded: {
    label: "검수 필요",
    severity: "info",
    action: "검수 전 제품은 사진, 영양성분, 원재료 근거를 보강하세요.",
    priority: 2,
  },
  personalWarning: {
    label: "개인 기준 경고",
    severity: "caution",
    action: "개인 기준에 걸린 제품은 선택한 성분 알림과 식이 선호를 다시 확인하세요.",
    priority: 1,
  },
  highRiskAdditive: {
    label: "고위험 첨가물",
    severity: "caution",
    action: "고위험 첨가물이 반복되면 대체상품 추천을 우선 확인하세요.",
    priority: 5,
  },
  sugar: {
    label: "당류 과다",
    severity: "caution",
    action: "당류가 높은 제품은 저당 대체상품과 1회 섭취량을 함께 확인하세요.",
    priority: 4,
  },
  sodium: {
    label: "나트륨 과다",
    severity: "caution",
    action: "나트륨이 높은 제품은 저나트륨 대체상품을 우선 비교하세요.",
    priority: 4,
  },
  saturatedFat: {
    label: "포화지방 과다",
    severity: "caution",
    action: "포화지방이 높은 제품은 같은 카테고리의 낮은 지방 제품과 비교하세요.",
    priority: 4,
  },
};

const hasReason = (product: Product, term: string) =>
  computeScore(product, { foodAlerts: [], dietaryPreferences: [] }).reasons.some((reason) =>
    `${reason.title} ${reason.desc}`.includes(term),
  );

function addConcernForProduct(
  product: Product,
  prefs: UserPreferences,
  concerns: Record<HistoryConcernKey, number>,
) {
  const score = computeScore(product, prefs);

  if (product.recall) concerns.recall += 1;
  if (!score.computable || product.status === "needs_review") concerns.reviewNeeded += 1;
  if (score.personalWarnings.length > 0) concerns.personalWarning += 1;
  if (score.warnings.some((warning) => warning.code === "high_risk_additive")) {
    concerns.highRiskAdditive += 1;
  }
  if (hasReason(product, "당류")) concerns.sugar += 1;
  if (hasReason(product, "나트륨")) concerns.sodium += 1;
  if (hasReason(product, "포화지방")) concerns.saturatedFat += 1;
}

function pickTopConcern(concerns: Record<HistoryConcernKey, number>): HistoryConcernSummary | null {
  const entries = (Object.keys(concerns) as HistoryConcernKey[])
    .filter((key) => concerns[key] > 0)
    .sort((a, b) => {
      const countDelta = concerns[b] - concerns[a];
      if (countDelta !== 0) return countDelta;
      return CONCERN_META[b].priority - CONCERN_META[a].priority;
    });

  const key = entries[0];
  if (!key) return null;
  const meta = CONCERN_META[key];
  return {
    key,
    label: meta.label,
    count: concerns[key],
    severity: meta.severity,
    action: meta.action,
  };
}

export function buildHistoryInsights(products: Product[], prefs: UserPreferences): HistoryInsights {
  const gradeCounts = emptyGradeCounts();
  const concerns = emptyConcerns();
  let scoreTotal = 0;
  let scoredCount = 0;

  for (const product of products) {
    const score = computeScore(product, prefs);
    if (score.computable && score.score !== null && score.grade !== null) {
      scoreTotal += score.score;
      scoredCount += 1;
      gradeCounts[score.grade] += 1;
    }
    addConcernForProduct(product, prefs, concerns);
  }

  return {
    totalCount: products.length,
    scoredCount,
    reviewNeededCount: concerns.reviewNeeded,
    averageScore: scoredCount > 0 ? Math.round(scoreTotal / scoredCount) : null,
    gradeCounts,
    concerns,
    topConcern: pickTopConcern(concerns),
  };
}

export function filterAttentionProducts(
  products: Product[],
  prefs: UserPreferences,
): AttentionProduct[] {
  return products
    .map((product) => {
      const score = computeScore(product, prefs);
      const reasons: string[] = [];

      if (product.recall) reasons.push("회수 이력");
      if (!score.computable || product.status === "needs_review") reasons.push("검수 필요");
      if (score.personalWarnings.length > 0) reasons.push("개인 기준 경고");
      if (score.warnings.some((warning) => warning.code === "high_risk_additive")) {
        reasons.push("고위험 첨가물");
      }
      if (hasReason(product, "당류")) reasons.push("당류 과다");
      if (hasReason(product, "나트륨")) reasons.push("나트륨 과다");
      if (hasReason(product, "포화지방")) reasons.push("포화지방 과다");

      return { product, reasons };
    })
    .filter((item) => item.reasons.length > 0);
}
