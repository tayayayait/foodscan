import type { Grade, Nutrition, Product, Severity, SourceTag, UserPreferences } from "./types";
import { classifyAdditive, type AdditiveRiskLevel } from "./additive-dictionary";
import { findDietaryPreferenceConflicts, findFoodAlertMatches } from "./preferences";

export interface ScoreResult {
  score: number | null;
  grade: Grade | null;
  severity: Severity;
  summary: string;
  reasons: { title: string; desc: string; severity: Severity; source: string }[];
  breakdown: {
    nutrition: number | null;
    additives: number | null;
    certification: number | null;
  };
  warnings: ScoreWarning[];
  personalWarnings: ScoreWarning[];
  computable: boolean;
}

export interface ScoreWarning {
  code: string;
  message: string;
  blocking: boolean;
  severity: Severity;
}

export function gradeOf(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

export function severityOfScore(score: number): Severity {
  if (score >= 70) return "good";
  if (score >= 55) return "normal";
  if (score >= 40) return "caution";
  return "danger";
}

export function gradeLabel(g: Grade): string {
  return {
    A: "매우 좋음",
    B: "양호",
    C: "보통",
    D: "주의",
    E: "피하는 것 권장",
  }[g];
}

const REQUIRED_NUTRITION_KEYS: (keyof Pick<
  Nutrition,
  "energyKcal" | "sugarsG" | "sodiumMg" | "saturatedFatG"
>)[] = ["energyKcal", "sugarsG", "sodiumMg", "saturatedFatG"];

const TRUSTED_SCORE_SOURCES = new Set<SourceTag>(["verified", "public_api", "open_db"]);

function missingRequiredNutrition(nutrition: Nutrition) {
  return REQUIRED_NUTRITION_KEYS.filter((key) => nutrition[key] === undefined);
}

function isLowConfidenceUnverified(product: Product) {
  const hasTrustedSource = product.sources.some((source) => TRUSTED_SCORE_SOURCES.has(source));
  const isProvisionalSource =
    product.sources.includes("ai_estimated") || product.sources.includes("user_submitted");
  return !hasTrustedSource && isProvisionalSource && product.confidence < 0.7;
}

function emptyBreakdown(): ScoreResult["breakdown"] {
  return {
    nutrition: null,
    additives: null,
    certification: null,
  };
}

function blockingResult(summary: string, warnings: ScoreWarning[]): ScoreResult {
  return {
    score: null,
    grade: null,
    severity: "info",
    summary,
    reasons: [],
    breakdown: emptyBreakdown(),
    warnings,
    personalWarnings: [],
    computable: false,
  };
}

function penaltyForValue(
  value: number | undefined,
  low: number,
  high: number,
  normalPenalty: number,
  dangerPenalty: number,
) {
  if (value === undefined) return 0;
  if (value <= low) return 0;
  if (value <= high) return normalPenalty;
  return dangerPenalty;
}

function computeNutritionScore(nutrition: Nutrition) {
  let score = 60;
  const reasons: ScoreResult["reasons"] = [];

  const energyPenalty = penaltyForValue(nutrition.energyKcal, 100, 250, 4, 8);
  const sugarPenalty = penaltyForValue(nutrition.sugarsG, 5, 15, 5, 14);
  const sodiumPenalty = penaltyForValue(nutrition.sodiumMg, 500, 1000, 5, 14);
  const saturatedFatPenalty = penaltyForValue(nutrition.saturatedFatG, 3, 7, 4, 10);

  score -= energyPenalty + sugarPenalty + sodiumPenalty + saturatedFatPenalty;

  if (nutrition.proteinG !== undefined && nutrition.proteinG >= 10) {
    score += 2;
  }
  if (nutrition.fiberG !== undefined && nutrition.fiberG >= 6) {
    score += 2;
  }
  if (nutrition.fruitsVegetablesPercent !== undefined && nutrition.fruitsVegetablesPercent >= 40) {
    score += 2;
  }

  if (sugarPenalty >= 14) {
    reasons.push({
      title: "당류 높음",
      desc: "100g/ml 기준 당류가 높습니다",
      severity: "caution",
      source: "nutrition",
    });
  }
  if (sodiumPenalty >= 14) {
    reasons.push({
      title: "나트륨 높음",
      desc: "100g/ml 기준 나트륨이 높습니다",
      severity: "caution",
      source: "nutrition",
    });
  }
  if (saturatedFatPenalty >= 10) {
    reasons.push({
      title: "포화지방 높음",
      desc: "100g/ml 기준 포화지방이 높습니다",
      severity: "caution",
      source: "nutrition",
    });
  }

  return {
    score: Math.max(0, Math.min(60, Math.round(score))),
    reasons,
  };
}

type AdditiveRisk = AdditiveRiskLevel;

export function additiveRiskOf(additive: string): AdditiveRisk {
  return classifyAdditive(additive).riskLevel;
}

function computeAdditiveScore(additives: string[]) {
  let score = 30;
  const reasons: ScoreResult["reasons"] = [];
  const warnings: ScoreWarning[] = [];
  let hasHighRisk = false;
  let unknownCount = 0;

  for (const additive of additives) {
    const classified = classifyAdditive(additive);
    score -= classified.scorePenalty;

    if (classified.riskLevel === "high_risk") {
      hasHighRisk = true;
      reasons.push({
        title: `고위험 첨가물: ${classified.name}`,
        desc: `${classified.riskBasis}. 총점 상한을 적용합니다.`,
        severity: classified.severity,
        source: `additive:${classified.riskLevel}`,
      });
    } else if (classified.riskLevel === "moderate_risk") {
      reasons.push({
        title: `주의 첨가물: ${classified.name}`,
        desc: classified.riskBasis,
        severity: classified.severity,
        source: `additive:${classified.riskLevel}`,
      });
    } else if (classified.reviewRequired) {
      unknownCount += 1;
    }
  }

  if (hasHighRisk) {
    warnings.push({
      code: "high_risk_additive",
      message: "고위험 또는 제한 사용 첨가물이 포함되어 총점 상한 49점을 적용합니다.",
      blocking: false,
      severity: "danger",
    });
  }
  if (unknownCount > 0) {
    warnings.push({
      code: "unknown_additive",
      message: `미분류 첨가물 ${unknownCount}개는 점수에 반영하지 않고 검수 대상으로 보냅니다.`,
      blocking: false,
      severity: "info",
    });
  }

  return {
    score: Math.max(0, Math.min(30, Math.round(score))),
    reasons,
    warnings,
    hasHighRisk,
  };
}

const CERTIFICATION_PATTERNS = ["유기농", "친환경", "organic", "eco"];

function hasTrustedCertification(product: Product) {
  if (!product.certifications?.length) return false;
  const hasTrustedSource =
    product.status === "verified" ||
    product.sources.some((source) => source === "verified" || source === "public_api");
  if (!hasTrustedSource) return false;
  return product.certifications.some((certification) =>
    CERTIFICATION_PATTERNS.some((pattern) =>
      certification.toLocaleLowerCase().includes(pattern.toLocaleLowerCase()),
    ),
  );
}

function certificationScore(product: Product) {
  if (hasTrustedCertification(product)) {
    return {
      score: 10,
      warning: null,
    };
  }
  return {
    score: 0,
    warning: {
      code: "certification_unknown",
      message: "공식 유기농·친환경 인증 정보가 확인되지 않았습니다",
      blocking: false,
      severity: "info" as const,
    },
  };
}

function personalWarningsFor(product: Product, prefs: UserPreferences): ScoreWarning[] {
  const warnings: ScoreWarning[] = [];
  const foodAlertMatches = findFoodAlertMatches(product, prefs);

  for (const match of foodAlertMatches) {
    warnings.push({
      code: `food_alert_${match.key}`,
      message:
        match.matchType === "direct"
          ? `선택한 성분 알림(${match.label})과 일치합니다`
          : `원재료에서 선택한 성분(${match.label})이 감지되었습니다`,
      blocking: match.matchType === "direct",
      severity: match.matchType === "direct" ? "danger" : "caution",
    });
  }

  const dietaryConflicts = findDietaryPreferenceConflicts(product, prefs);
  for (const conflict of dietaryConflicts) {
    warnings.push({
      code: `dietary_preference_${conflict.key}`,
      message: `선택한 식이 선호(${conflict.label})와 맞지 않을 수 있습니다`,
      blocking: false,
      severity: "caution",
    });
  }

  return warnings;
}

function summaryFor(grade: Grade, hasWarnings: boolean) {
  if (hasWarnings) return "점수와 별도로 확인이 필요한 경고가 있습니다";
  if (grade === "A") return "전반적으로 부담이 매우 낮은 제품입니다";
  if (grade === "B") return "전반적으로 부담이 낮은 제품입니다";
  if (grade === "C") return "보통 수준의 제품입니다";
  return "주의가 필요한 항목이 있습니다";
}

export function computeScore(product: Product, prefs: UserPreferences): ScoreResult {
  if (isLowConfidenceUnverified(product)) {
    return blockingResult("검수 전 저신뢰 데이터라 점수를 확정할 수 없습니다", [
      {
        code: "low_confidence",
        message: "AI 또는 사용자 제출 데이터의 신뢰도가 낮습니다",
        blocking: true,
        severity: "caution",
      },
    ]);
  }

  const missing = missingRequiredNutrition(product.nutrition);
  if (missing.length >= 2) {
    return blockingResult("점수 산출에 필요한 영양성분 정보가 부족합니다", [
      {
        code: "nutrition_insufficient",
        message: "열량, 당류, 나트륨, 포화지방 중 2개 이상이 누락되었습니다",
        blocking: true,
        severity: "info",
      },
    ]);
  }

  const nutrition = computeNutritionScore(product.nutrition);
  const additives = computeAdditiveScore(product.additives);
  const certification = certificationScore(product);
  const warnings = [...additives.warnings];
  const personalWarnings = personalWarningsFor(product, prefs);

  if (certification.warning) warnings.push(certification.warning);
  if (missing.length === 1) {
    warnings.push({
      code: "nutrition_partial",
      message: `필수 영양성분 ${missing[0]} 정보가 누락되었습니다`,
      blocking: false,
      severity: "info",
    });
  }
  if (product.recall) {
    warnings.push({
      code: "recall",
      message: product.recall.reason,
      blocking: true,
      severity: "danger",
    });
  }

  let score = nutrition.score + additives.score + certification.score;
  if (additives.hasHighRisk) score = Math.min(score, 49);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeOf(score);

  return {
    score,
    grade,
    severity: severityOfScore(score),
    summary: summaryFor(
      grade,
      warnings.some((warning) => warning.blocking) || personalWarnings.length > 0,
    ),
    reasons: [...nutrition.reasons, ...additives.reasons].slice(0, 3),
    breakdown: {
      nutrition: nutrition.score,
      additives: additives.score,
      certification: certification.score,
    },
    warnings,
    personalWarnings,
    computable: true,
  };
}
