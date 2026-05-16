import type { Product, Severity } from "./types";
import type { ScoreResult } from "./score";
import { gradeLabel } from "./score";

export interface ProductVerdictFinding {
  title: string;
  desc: string;
  severity: Severity;
}

export interface ProductVerdictSummary {
  scoreText: string;
  scoreSubtext: string;
  verdictText: string;
  tone: Severity;
  trustLabel: string;
  trustSeverity: Severity;
  confidenceLabel: string;
  topFindings: ProductVerdictFinding[];
}

const TRUST_LABELS: Record<
  Product["status"],
  { label: string; severity: Severity; fallbackSubtext?: string }
> = {
  verified: { label: "검수 완료", severity: "good" },
  public_matched: { label: "공공데이터 기반", severity: "info" },
  open_db_matched: { label: "공개 DB 참고", severity: "info" },
  provisional: { label: "임시 분석", severity: "caution", fallbackSubtext: "임시 정보" },
  needs_review: { label: "검수 필요", severity: "caution", fallbackSubtext: "임시 정보" },
};

const WARNING_TITLES: Record<string, string> = {
  recall: "회수·판매중지",
  high_risk_additive: "고위험 첨가물",
  low_confidence: "검수 필요",
  nutrition_insufficient: "영양 정보 부족",
  nutrition_partial: "영양 정보 일부 누락",
  unknown_additive: "미분류 첨가물",
  food_alert_gluten: "성분 알림",
  food_alert_lactose: "성분 알림",
  food_alert_sulfites: "성분 알림",
  food_alert_soy: "성분 알림",
  food_alert_palm_oil: "성분 알림",
  dietary_preference_vegetarian: "식이 선호",
  dietary_preference_vegan: "식이 선호",
  dietary_preference_pork_free: "식이 선호",
};

const LOW_PRIORITY_WARNING_CODES = new Set(["certification_unknown"]);

function findingFromWarning(warning: ScoreResult["warnings"][number]): ProductVerdictFinding {
  return {
    title: WARNING_TITLES[warning.code] ?? "확인 필요",
    desc: warning.message,
    severity: warning.severity,
  };
}

function topFindings(score: ScoreResult): ProductVerdictFinding[] {
  const blockingWarnings = [...score.warnings, ...score.personalWarnings]
    .filter((warning) => warning.blocking)
    .map(findingFromWarning);
  const cautionWarnings = [...score.warnings, ...score.personalWarnings]
    .filter((warning) => !warning.blocking && !LOW_PRIORITY_WARNING_CODES.has(warning.code))
    .map(findingFromWarning);
  const reasons = score.reasons.map((reason) => ({
    title: reason.title,
    desc: reason.desc,
    severity: reason.severity,
  }));

  return [...blockingWarnings, ...cautionWarnings, ...reasons].slice(0, 3);
}

export function buildProductVerdict(product: Product, score: ScoreResult): ProductVerdictSummary {
  const trust = TRUST_LABELS[product.status];
  const confidenceLabel = `신뢰도 ${(product.confidence * 100).toFixed(0)}%`;

  if (!score.computable || score.score === null || score.grade === null) {
    return {
      scoreText: trust.label === "검수 필요" ? "검수 필요" : "평가 불가",
      scoreSubtext: trust.fallbackSubtext ?? "정보 부족",
      verdictText: score.summary,
      tone: trust.severity,
      trustLabel: trust.label,
      trustSeverity: trust.severity,
      confidenceLabel,
      topFindings: topFindings(score),
    };
  }

  return {
    scoreText: String(score.score),
    scoreSubtext: `${score.grade} · ${gradeLabel(score.grade)}`,
    verdictText: score.summary,
    tone: score.severity,
    trustLabel: trust.label,
    trustSeverity: trust.severity,
    confidenceLabel,
    topFindings: topFindings(score),
  };
}
