import { computeScore, type ScoreWarning } from "./score";
import type { Product, Severity, UserPreferences } from "./types";

export type SafetyWatchSource = "saved" | "recent" | "provisional";

export type SafetyWatchReasonKey =
  | "recall"
  | "food_alert_direct"
  | "food_alert_estimated"
  | "high_risk_additive"
  | "personal_preference"
  | "low_confidence"
  | "nutrition_insufficient"
  | "needs_review";

export interface SafetyWatchInput {
  recent: Product[];
  saved: Product[];
  provisional: Product[];
  prefs: UserPreferences;
}

export interface SafetyWatchReason {
  key: SafetyWatchReasonKey;
  label: string;
  detail: string;
  severity: Severity;
  priority: number;
}

export interface SafetyWatchItem {
  product: Product;
  sources: SafetyWatchSource[];
  sourceLabels: string[];
  reasons: SafetyWatchReason[];
  severity: Severity;
  action: string;
}

export interface SafetyWatchSummary {
  totalWatched: number;
  flaggedCount: number;
  dangerCount: number;
  cautionCount: number;
  infoCount: number;
  recallCount: number;
  savedFlaggedCount: number;
}

export interface SafetyWatchResult {
  summary: SafetyWatchSummary;
  items: SafetyWatchItem[];
}

interface WatchedProduct {
  product: Product;
  sources: SafetyWatchSource[];
}

const SOURCE_LABELS: Record<SafetyWatchSource, string> = {
  saved: "저장",
  recent: "최근",
  provisional: "임시",
};

const SOURCE_ORDER: SafetyWatchSource[] = ["saved", "recent", "provisional"];

const SEVERITY_RANK: Record<Severity, number> = {
  danger: 4,
  caution: 3,
  normal: 2,
  info: 1,
  good: 0,
};

function productIdentity(product: Product) {
  return product.barcode || product.id;
}

function sourceLabels(sources: SafetyWatchSource[]) {
  return SOURCE_ORDER.filter((source) => sources.includes(source)).map(
    (source) => SOURCE_LABELS[source],
  );
}

function highestSeverity(reasons: SafetyWatchReason[]): Severity {
  return reasons.reduce<Severity>(
    (highest, reason) =>
      SEVERITY_RANK[reason.severity] > SEVERITY_RANK[highest] ? reason.severity : highest,
    "info",
  );
}

function warningReason(warning: ScoreWarning): SafetyWatchReason | null {
  if (warning.code === "recall") {
    return {
      key: "recall",
      label: "회수·판매중지",
      detail: warning.message,
      severity: "danger",
      priority: 100,
    };
  }
  if (warning.code === "high_risk_additive") {
    return {
      key: "high_risk_additive",
      label: "고위험 첨가물",
      detail: warning.message,
      severity: "danger",
      priority: 80,
    };
  }
  if (warning.code === "low_confidence") {
    return {
      key: "low_confidence",
      label: "저신뢰 데이터",
      detail: warning.message,
      severity: "caution",
      priority: 40,
    };
  }
  if (warning.code === "nutrition_insufficient") {
    return {
      key: "nutrition_insufficient",
      label: "영양 정보 부족",
      detail: warning.message,
      severity: "info",
      priority: 30,
    };
  }
  return null;
}

function personalWarningReason(warning: ScoreWarning): SafetyWatchReason | null {
  if (warning.code.startsWith("food_alert_") && warning.blocking) {
    return {
      key: "food_alert_direct",
      label: "성분 알림 직접 일치",
      detail: warning.message,
      severity: "danger",
      priority: 90,
    };
  }
  if (warning.code.startsWith("food_alert_")) {
    return {
      key: "food_alert_estimated",
      label: "성분 알림 추정",
      detail: warning.message,
      severity: "caution",
      priority: 70,
    };
  }
  if (warning.code.startsWith("dietary_preference_")) {
    return {
      key: "personal_preference",
      label: "식이 선호 경고",
      detail: warning.message,
      severity: "caution",
      priority: 50,
    };
  }
  return null;
}

function productReasons(product: Product, prefs: UserPreferences): SafetyWatchReason[] {
  const score = computeScore(product, prefs);
  const reasons = [
    ...score.warnings.map(warningReason),
    ...score.personalWarnings.map(personalWarningReason),
  ].filter((reason): reason is SafetyWatchReason => reason !== null);

  if (
    product.status === "needs_review" &&
    !reasons.some(
      (reason) => reason.key === "low_confidence" || reason.key === "nutrition_insufficient",
    )
  ) {
    reasons.push({
      key: "needs_review",
      label: "검수 필요",
      detail: "검수 완료 전 데이터입니다.",
      severity: "info",
      priority: 20,
    });
  }

  return reasons.sort((a, b) => b.priority - a.priority);
}

function actionFor(reasons: SafetyWatchReason[]) {
  if (reasons.some((reason) => reason.key === "recall")) {
    return "섭취 전 회수 공지와 판매중지 여부를 확인하세요.";
  }
  if (
    reasons.some(
      (reason) => reason.key === "food_alert_direct" || reason.key === "food_alert_estimated",
    )
  ) {
    return "선택한 성분 알림에 해당하므로 라벨 원문을 확인하세요.";
  }
  if (reasons.some((reason) => reason.key === "high_risk_additive")) {
    return "고위험 첨가물이 없는 대체상품을 우선 확인하세요.";
  }
  if (reasons.some((reason) => reason.severity === "caution")) {
    return "제품 상세에서 근거와 개인 기준을 재확인하세요.";
  }
  return "사진, 영양성분, 원재료 근거를 보강한 뒤 검수하세요.";
}

function maxReasonPriority(reasons: SafetyWatchReason[]) {
  return Math.max(...reasons.map((reason) => reason.priority), 0);
}

function isNewer(a: Product, b: Product) {
  return Date.parse(a.updatedAt) > Date.parse(b.updatedAt);
}

function betterProduct(a: Product, b: Product, prefs: UserPreferences) {
  const aReasons = productReasons(a, prefs);
  const bReasons = productReasons(b, prefs);
  const severityDelta =
    SEVERITY_RANK[highestSeverity(aReasons)] - SEVERITY_RANK[highestSeverity(bReasons)];
  if (severityDelta !== 0) return severityDelta > 0 ? a : b;
  const priorityDelta = maxReasonPriority(aReasons) - maxReasonPriority(bReasons);
  if (priorityDelta !== 0) return priorityDelta > 0 ? a : b;
  return isNewer(a, b) ? a : b;
}

function collectProducts(input: SafetyWatchInput): WatchedProduct[] {
  const byIdentity = new Map<string, WatchedProduct>();
  const add = (products: Product[], source: SafetyWatchSource) => {
    for (const product of products) {
      const key = productIdentity(product);
      const existing = byIdentity.get(key);
      if (!existing) {
        byIdentity.set(key, { product, sources: [source] });
        continue;
      }
      if (!existing.sources.includes(source)) existing.sources.push(source);
      existing.product = betterProduct(existing.product, product, input.prefs);
    }
  };

  add(input.saved, "saved");
  add(input.recent, "recent");
  add(input.provisional, "provisional");

  return [...byIdentity.values()].map((item) => ({
    ...item,
    sources: SOURCE_ORDER.filter((source) => item.sources.includes(source)),
  }));
}

export function buildSafetyWatch(input: SafetyWatchInput): SafetyWatchResult {
  const watchedProducts = collectProducts(input);
  const items = watchedProducts
    .map((watched): SafetyWatchItem | null => {
      const reasons = productReasons(watched.product, input.prefs);
      if (reasons.length === 0) return null;
      const severity = highestSeverity(reasons);
      return {
        product: watched.product,
        sources: watched.sources,
        sourceLabels: sourceLabels(watched.sources),
        reasons,
        severity,
        action: actionFor(reasons),
      };
    })
    .filter((item): item is SafetyWatchItem => item !== null)
    .sort((a, b) => {
      const severityDelta = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (severityDelta !== 0) return severityDelta;
      const priorityDelta = maxReasonPriority(b.reasons) - maxReasonPriority(a.reasons);
      if (priorityDelta !== 0) return priorityDelta;
      return Date.parse(b.product.updatedAt) - Date.parse(a.product.updatedAt);
    });

  return {
    summary: {
      totalWatched: watchedProducts.length,
      flaggedCount: items.length,
      dangerCount: items.filter((item) => item.severity === "danger").length,
      cautionCount: items.filter((item) => item.severity === "caution").length,
      infoCount: items.filter((item) => item.severity === "info").length,
      recallCount: items.filter((item) => item.reasons.some((reason) => reason.key === "recall"))
        .length,
      savedFlaggedCount: items.filter((item) => item.sources.includes("saved")).length,
    },
    items,
  };
}
