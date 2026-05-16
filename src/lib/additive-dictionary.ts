/**
 * Food additive dictionary.
 *
 * Classifies additive names, E-numbers, and Open Food Facts additive tags into
 * a product UI category plus a scoring/review risk profile.
 */

import type { Severity } from "./types";

export type AdditiveCategory =
  | "sweetener"
  | "preservative"
  | "antioxidant"
  | "colorant"
  | "acidity_regulator"
  | "stabilizer"
  | "anticaking_agent"
  | "flavor"
  | "unknown";

export type AdditiveRiskLevel =
  | "risk_free"
  | "limited_risk"
  | "moderate_risk"
  | "high_risk"
  | "unknown";

export type AdditiveExplanationSource = "dictionary" | "fallback" | "gemini_estimated";
export type AdditiveEvidenceLevel =
  | "official_restriction"
  | "regulatory_condition"
  | "safety_evaluated"
  | "unmatched";

export interface AdditiveRiskProfile {
  level: AdditiveRiskLevel;
  label: string;
  severity: Severity;
  scorePenalty: number;
  scoreCap?: number;
  reviewRequired: boolean;
  basis: string;
  sourceUrls?: string[];
  evidenceLevel?: AdditiveEvidenceLevel;
}

export interface ClassifiedAdditive {
  name: string;
  code?: string;
  displayName: string;
  purposeLabel: string;
  consumerSummary: string;
  explanationSource: AdditiveExplanationSource;
  category: AdditiveCategory;
  categoryLabel: string;
  severity: Severity;
  riskLevel: AdditiveRiskLevel;
  riskLabel: string;
  riskBasis: string;
  scorePenalty: number;
  scoreCap?: number;
  reviewRequired: boolean;
  sourceUrls: string[];
  evidenceLevel: AdditiveEvidenceLevel;
}

export interface AdditiveRiskProfileSeed {
  canonicalName: string;
  aliases: string[];
  eNumber?: string;
  insNumber?: string;
  casNumber?: string;
  category: AdditiveCategory;
  purposeLabel: string;
  consumerSummary: string;
  riskLevel: AdditiveRiskLevel;
  scorePenalty: number;
  scoreCap?: number;
  reviewRequired: boolean;
  basisKo: string;
  sourceUrls: string[];
  evidenceLevel: AdditiveEvidenceLevel;
}

const CATEGORY_META: Record<AdditiveCategory, { label: string; severity: Severity }> = {
  sweetener: { label: "감미료", severity: "caution" },
  preservative: { label: "보존료", severity: "caution" },
  antioxidant: { label: "산화방지제", severity: "info" },
  colorant: { label: "착색료", severity: "caution" },
  acidity_regulator: { label: "산도조절제", severity: "info" },
  stabilizer: { label: "증점제/안정제", severity: "info" },
  anticaking_agent: { label: "고결방지제", severity: "info" },
  flavor: { label: "향료/풍미증진제", severity: "info" },
  unknown: { label: "분류 정보 없음", severity: "info" },
};

const RISK_META: Record<AdditiveRiskLevel, AdditiveRiskProfile> = {
  risk_free: {
    level: "risk_free",
    label: "위험도 낮음",
    severity: "good",
    scorePenalty: 0,
    reviewRequired: false,
    basis: "일반 사용 첨가물 분류",
  },
  limited_risk: {
    level: "limited_risk",
    label: "제한적 주의",
    severity: "normal",
    scorePenalty: 4,
    reviewRequired: false,
    basis: "섭취량과 사용 목적 확인 권장",
  },
  moderate_risk: {
    level: "moderate_risk",
    label: "주의 필요",
    severity: "caution",
    scorePenalty: 10,
    reviewRequired: false,
    basis: "주의 대상 첨가물 기준",
  },
  high_risk: {
    level: "high_risk",
    label: "고위험/제한 사용",
    severity: "danger",
    scorePenalty: 18,
    scoreCap: 49,
    reviewRequired: false,
    basis: "강한 주의 대상 첨가물 기준",
  },
  unknown: {
    level: "unknown",
    label: "확실한 정보 없음",
    severity: "info",
    scorePenalty: 0,
    reviewRequired: true,
    basis: "사전 미분류 첨가물",
  },
};

const OFF_API_SOURCE = "https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/";
const CODEX_GSFA_SOURCE = "https://www.fao.org/gsfaonline/";
const CODEX_GSFA_GUAR_GUM_SOURCE = "https://www.fao.org/gsfaonline/additives/details.html?id=9";
const JECFA_SOURCE = "https://apps.who.int/food-additives-contaminants-jecfa-database/";
const JECFA_GUAR_GUM_SOURCE = "https://inchem.org/documents/jecfa/jeceval/jec_946.htm";
const EFSA_OPENFOODTOX_SOURCE =
  "https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox";
const EFSA_E171_SOURCE =
  "https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive";
const EU_ADDITIVES_SOURCE =
  "https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en";
const FDA_SAF_SOURCE =
  "https://www.fda.gov/food/food-additives-petitions/substances-added-food-formerly-eafus";
const HEALTH_CANADA_SOURCE = "https://health-infobase.canada.ca/nutrition/food-additives/";

export const ADDITIVE_RISK_PROFILE_SEEDS: AdditiveRiskProfileSeed[] = [
  {
    canonicalName: "이산화티타늄",
    aliases: ["E171", "TITANIUMDIOXIDE", "TITANIUM DIOXIDE"],
    eNumber: "E171",
    insNumber: "INS171",
    category: "colorant",
    purposeLabel: "색 부여",
    consumerSummary:
      "흰색을 내는 착색료입니다. EFSA 2021 안전성 재평가에서 식품첨가물로 안전하다고 볼 수 없다는 결론이 제시되어 강한 주의 대상으로 분류합니다.",
    riskLevel: "high_risk",
    scorePenalty: 18,
    scoreCap: 49,
    reviewRequired: false,
    basisKo: "EFSA 2021 E171 안전성 재평가에서 식품첨가물 사용 안전성에 중대한 이슈가 제기됨",
    sourceUrls: [EFSA_E171_SOURCE, EFSA_OPENFOODTOX_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "official_restriction",
  },
  {
    canonicalName: "아질산나트륨",
    aliases: ["E250", "SODIUMNITRITE", "SODIUM NITRITE"],
    eNumber: "E250",
    insNumber: "INS250",
    category: "preservative",
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.",
    riskLevel: "high_risk",
    scorePenalty: 18,
    scoreCap: 49,
    reviewRequired: false,
    basisKo: "아질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "아질산칼륨",
    aliases: ["E249", "POTASSIUMNITRITE", "POTASSIUM NITRITE"],
    eNumber: "E249",
    insNumber: "INS249",
    category: "preservative",
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.",
    riskLevel: "high_risk",
    scorePenalty: 18,
    scoreCap: 49,
    reviewRequired: false,
    basisKo: "아질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "질산나트륨",
    aliases: ["E251", "SODIUMNITRATE", "SODIUM NITRATE"],
    eNumber: "E251",
    insNumber: "INS251",
    category: "preservative",
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.",
    riskLevel: "high_risk",
    scorePenalty: 18,
    scoreCap: 49,
    reviewRequired: false,
    basisKo: "질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "질산칼륨",
    aliases: ["E252", "POTASSIUMNITRATE", "POTASSIUM NITRATE"],
    eNumber: "E252",
    insNumber: "INS252",
    category: "preservative",
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.",
    riskLevel: "high_risk",
    scorePenalty: 18,
    scoreCap: 49,
    reviewRequired: false,
    basisKo: "질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "아스파탐",
    aliases: ["E951", "ASPARTAME"],
    eNumber: "E951",
    insNumber: "INS951",
    category: "sweetener",
    purposeLabel: "단맛 부여",
    consumerSummary:
      "저칼로리 감미료입니다. ADI와 섭취량 관리 기준이 있어 주의 필요 항목으로 분류합니다.",
    riskLevel: "moderate_risk",
    scorePenalty: 10,
    reviewRequired: false,
    basisKo: "ADI와 섭취량 기준이 있는 감미료이며 민감군·총 섭취량 확인이 필요함",
    sourceUrls: [JECFA_SOURCE, EFSA_OPENFOODTOX_SOURCE, CODEX_GSFA_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "수크랄로스",
    aliases: ["E955", "SUCRALOSE"],
    eNumber: "E955",
    insNumber: "INS955",
    category: "sweetener",
    purposeLabel: "단맛 부여",
    consumerSummary:
      "고감미 감미료입니다. ADI와 섭취량 관리 기준이 있어 주의 필요 항목으로 분류합니다.",
    riskLevel: "moderate_risk",
    scorePenalty: 10,
    reviewRequired: false,
    basisKo: "ADI와 섭취량 기준이 있는 감미료이며 총 섭취량 확인이 필요함",
    sourceUrls: [JECFA_SOURCE, EFSA_OPENFOODTOX_SOURCE, CODEX_GSFA_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "타르트라진",
    aliases: ["E102", "TARTRAZINE", "식용색소황색4호"],
    eNumber: "E102",
    insNumber: "INS102",
    category: "colorant",
    purposeLabel: "색 부여",
    consumerSummary:
      "노란색을 내는 착색료입니다. 착색료 계열 주의 대상으로 분류하며 민감군은 표시 정보를 확인해야 합니다.",
    riskLevel: "moderate_risk",
    scorePenalty: 10,
    reviewRequired: false,
    basisKo: "착색료 계열로 사용 조건과 민감군 주의가 필요한 항목",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "안식향산나트륨",
    aliases: ["E211", "SODIUMBENZOATE", "SODIUM BENZOATE", "안식향산"],
    eNumber: "E211",
    insNumber: "INS211",
    category: "preservative",
    purposeLabel: "보존성 유지",
    consumerSummary:
      "미생물 증식을 늦추는 보존료입니다. 사용 기준과 총 섭취량 확인이 필요한 항목으로 분류합니다.",
    riskLevel: "moderate_risk",
    scorePenalty: 10,
    reviewRequired: false,
    basisKo: "보존료 계열로 사용 조건과 총 노출량 확인이 필요한 항목",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "합성착향료",
    aliases: [
      "합성향료",
      "착향료",
      "ARTIFICIALFLAVOR",
      "ARTIFICIAL FLAVOR",
      "SYNTHETICFLAVOR",
      "SYNTHETIC FLAVOR",
      "FLAVOURING",
      "FLAVORING",
    ],
    category: "flavor",
    purposeLabel: "향미 보강",
    consumerSummary:
      "향미를 보강하는 향료 계열 표시입니다. 구체 물질과 함량이 없으면 독성 등급을 확정할 수 없어 제한적 주의로 표시합니다.",
    riskLevel: "limited_risk",
    scorePenalty: 4,
    reviewRequired: false,
    basisKo: "향료 계열은 구체 물질과 함량 확인 전까지 제한적 주의로 처리",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, FDA_SAF_SOURCE],
    evidenceLevel: "regulatory_condition",
  },
  {
    canonicalName: "글루탐산나트륨(MSG)",
    aliases: ["E621", "MSG", "MONOSODIUMGLUTAMATE", "MONOSODIUM GLUTAMATE", "글루탐산나트륨"],
    eNumber: "E621",
    insNumber: "INS621",
    category: "flavor",
    purposeLabel: "감칠맛 보강",
    consumerSummary:
      "감칠맛을 보강하는 풍미증진제입니다. 일반적 사용 기준 내에서는 허용되지만 섭취량 확인이 필요한 제한적 주의 항목입니다.",
    riskLevel: "limited_risk",
    scorePenalty: 4,
    reviewRequired: false,
    basisKo: "풍미증진제 계열로 사용 목적과 섭취량 확인이 권장됨",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, HEALTH_CANADA_SOURCE],
    evidenceLevel: "safety_evaluated",
  },
  {
    canonicalName: "구연산",
    aliases: ["E330", "CITRICACID", "CITRIC ACID"],
    eNumber: "E330",
    insNumber: "INS330",
    category: "acidity_regulator",
    purposeLabel: "산도 조절",
    consumerSummary: "맛과 산도를 조절하거나 제조 공정을 안정화하는 산도조절제입니다.",
    riskLevel: "risk_free",
    scorePenalty: 0,
    reviewRequired: false,
    basisKo: "공식 기준 내 일반 사용에서 주요 위해 근거가 낮은 산도조절제",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "safety_evaluated",
  },
  {
    canonicalName: "구아검",
    aliases: [
      "E412",
      "GUARGUM",
      "GUAR GUM",
      "GUARFLOUR",
      "GUAR FLOUR",
      "GUMCYAMOPSIS",
      "GUM CYAMOPSIS",
    ],
    eNumber: "E412",
    insNumber: "INS412",
    category: "stabilizer",
    purposeLabel: "점도 조절·안정화",
    consumerSummary: "식품의 점도를 높이고 재료가 분리되지 않도록 돕는 증점제·안정제입니다.",
    riskLevel: "risk_free",
    scorePenalty: 0,
    reviewRequired: false,
    basisKo:
      "Codex GSFA는 구아검(INS 412)을 증점제·안정제·유화제로 등재하고 JECFA는 ADI를 not specified로 평가함",
    sourceUrls: [CODEX_GSFA_GUAR_GUM_SOURCE, JECFA_GUAR_GUM_SOURCE],
    evidenceLevel: "safety_evaluated",
  },
  {
    canonicalName: "이산화규소",
    aliases: ["E551", "SILICONDIOXIDE", "SILICON DIOXIDE", "SILICA"],
    eNumber: "E551",
    insNumber: "INS551",
    category: "anticaking_agent",
    purposeLabel: "가루 뭉침 방지",
    consumerSummary: "분말 조미료나 가루 원료가 서로 뭉치지 않게 하는 고결방지제입니다.",
    riskLevel: "risk_free",
    scorePenalty: 0,
    reviewRequired: false,
    basisKo: "식품첨가물공전 사용기준상 고결방지제·거품제거제·여과보조제 목적 사용",
    sourceUrls: [CODEX_GSFA_SOURCE, JECFA_SOURCE, EU_ADDITIVES_SOURCE],
    evidenceLevel: "safety_evaluated",
  },
  {
    canonicalName: "혼합제제",
    aliases: ["MIXEDPREPARATION", "MIXED PREPARATION", "혼합제제류"],
    category: "unknown",
    purposeLabel: "분류 정보 없음",
    consumerSummary:
      "여러 첨가물을 섞은 제제 표시로, 단일 구체 첨가물명이 아닙니다. 구성 성분 원문이 필요합니다.",
    riskLevel: "unknown",
    scorePenalty: 0,
    reviewRequired: true,
    basisKo:
      "구체 첨가물명이 아닙니다. 혼합제제의 구성 성분이 확인되기 전까지 위험도를 확정하지 않습니다.",
    sourceUrls: [OFF_API_SOURCE],
    evidenceLevel: "unmatched",
  },
];

const ADDITIVE_MAP: Record<string, AdditiveCategory> = {
  // Sweeteners
  아스파탐: "sweetener",
  ASPARTAME: "sweetener",
  수크랄로스: "sweetener",
  SUCRALOSE: "sweetener",
  아세설팜칼륨: "sweetener",
  아세설팜K: "sweetener",
  ACESULFAMEK: "sweetener",
  사카린나트륨: "sweetener",
  SACCHARIN: "sweetener",
  스테비올배당체: "sweetener",
  STEVIA: "sweetener",
  에리스리톨: "sweetener",
  ERYTHRITOL: "sweetener",
  자일리톨: "sweetener",
  XYLITOL: "sweetener",
  E950: "sweetener",
  E951: "sweetener",
  E952: "sweetener",
  E954: "sweetener",
  E955: "sweetener",
  E960: "sweetener",
  E967: "sweetener",
  E968: "sweetener",

  // Preservatives
  소브산칼륨: "preservative",
  POTASSIUMSORBATE: "preservative",
  안식향산나트륨: "preservative",
  SODIUMBENZOATE: "preservative",
  프로피온산칼슘: "preservative",
  아질산나트륨: "preservative",
  SODIUMNITRITE: "preservative",
  아질산칼륨: "preservative",
  POTASSIUMNITRITE: "preservative",
  질산나트륨: "preservative",
  SODIUMNITRATE: "preservative",
  질산칼륨: "preservative",
  POTASSIUMNITRATE: "preservative",
  E200: "preservative",
  E202: "preservative",
  E210: "preservative",
  E211: "preservative",
  E249: "preservative",
  E250: "preservative",
  E251: "preservative",
  E252: "preservative",
  E280: "preservative",
  E281: "preservative",
  E282: "preservative",

  // Antioxidants
  TBHQ: "antioxidant",
  터셔리부틸히드로퀴논: "antioxidant",
  TERTIARYBUTYLHYDROQUINONE: "antioxidant",
  TERTBUTYLHYDROQUINONE: "antioxidant",
  E319: "antioxidant",

  // Colorants
  식용색소적색2호: "colorant",
  식용색소적색3호: "colorant",
  식용색소적색40호: "colorant",
  식용색소황색4호: "colorant",
  식용색소황색5호: "colorant",
  식용색소청색1호: "colorant",
  식용색소녹색3호: "colorant",
  타르색소: "colorant",
  CARAMELCOLOR: "colorant",
  캐러멜색소: "colorant",
  이산화티타늄: "colorant",
  TITANIUMDIOXIDE: "colorant",
  TARTRAZINE: "colorant",
  E100: "colorant",
  E101: "colorant",
  E102: "colorant",
  E104: "colorant",
  E110: "colorant",
  E120: "colorant",
  E122: "colorant",
  E124: "colorant",
  E127: "colorant",
  E129: "colorant",
  E131: "colorant",
  E132: "colorant",
  E133: "colorant",
  E141: "colorant",
  E142: "colorant",
  E150A: "colorant",
  E150B: "colorant",
  E150C: "colorant",
  E150D: "colorant",
  E160A: "colorant",
  E160B: "colorant",
  E171: "colorant",

  // Acidity regulators
  구연산: "acidity_regulator",
  CITRICACID: "acidity_regulator",
  구연산나트륨: "acidity_regulator",
  젖산: "acidity_regulator",
  말산: "acidity_regulator",
  인산: "acidity_regulator",
  탄산수소나트륨: "acidity_regulator",
  SODIUMBICARBONATE: "acidity_regulator",
  E270: "acidity_regulator",
  E296: "acidity_regulator",
  E330: "acidity_regulator",
  E331: "acidity_regulator",
  E334: "acidity_regulator",
  E338: "acidity_regulator",
  E339: "acidity_regulator",
  E500: "acidity_regulator",

  // Stabilizers and thickeners
  구아검: "stabilizer",
  GUARGUM: "stabilizer",
  GUARFLOUR: "stabilizer",
  GUMCYAMOPSIS: "stabilizer",
  E412: "stabilizer",

  // Anti-caking agents
  이산화규소: "anticaking_agent",
  SILICONDIOXIDE: "anticaking_agent",
  SILICA: "anticaking_agent",
  E551: "anticaking_agent",

  // Flavors and flavor enhancers
  합성향료: "flavor",
  천연향료: "flavor",
  바닐린: "flavor",
  VANILLIN: "flavor",
  MSG: "flavor",
  글루탐산나트륨: "flavor",
  MONOSODIUMGLUTAMATE: "flavor",
  "L-글루탐산나트륨": "flavor",
  E620: "flavor",
  E621: "flavor",
  E627: "flavor",
  E631: "flavor",
  E635: "flavor",
};

interface KnownAdditiveInfo {
  keys: string[];
  code?: string;
  displayName: string;
  category: AdditiveCategory;
  purposeLabel: string;
  consumerSummary: string;
  profile: AdditiveRiskProfile;
}

const PURPOSE_COPY: Record<
  Exclude<AdditiveCategory, "unknown">,
  { purpose: string; summary: string; profile: AdditiveRiskProfile }
> = {
  sweetener: {
    purpose: "단맛 부여",
    summary: "설탕 대신 단맛을 내거나 단맛을 보강하는 감미료입니다.",
    profile: RISK_META.limited_risk,
  },
  preservative: {
    purpose: "보존성 유지",
    summary: "미생물 증식이나 품질 변화를 늦춰 보관성을 높이는 보존료입니다.",
    profile: RISK_META.limited_risk,
  },
  antioxidant: {
    purpose: "산화 방지",
    summary: "기름·지방 등의 산화를 늦춰 맛과 냄새 변화를 줄이는 산화방지제입니다.",
    profile: RISK_META.limited_risk,
  },
  colorant: {
    purpose: "색 부여",
    summary: "식품에 색을 더하거나 제품 색을 일정하게 맞추는 착색료입니다.",
    profile: RISK_META.limited_risk,
  },
  acidity_regulator: {
    purpose: "산도 조절",
    summary: "맛과 산도를 조절하거나 제조 공정을 안정화하는 산도조절제입니다.",
    profile: RISK_META.risk_free,
  },
  stabilizer: {
    purpose: "점도 조절·안정화",
    summary: "식품의 점도를 높이거나 재료가 분리되지 않도록 돕는 증점제·안정제입니다.",
    profile: RISK_META.risk_free,
  },
  anticaking_agent: {
    purpose: "가루 뭉침 방지",
    summary: "분말 조미료나 가루 원료가 서로 뭉치지 않게 하는 고결방지제입니다.",
    profile: RISK_META.risk_free,
  },
  flavor: {
    purpose: "감칠맛 보강",
    summary: "제품의 감칠맛이나 풍미를 보강하는 풍미증진제입니다.",
    profile: RISK_META.limited_risk,
  },
};

function knownE(
  code: string,
  displayName: string,
  category: Exclude<AdditiveCategory, "unknown">,
  extraKeys: string[] = [],
  overrides: Partial<Pick<KnownAdditiveInfo, "purposeLabel" | "consumerSummary" | "profile">> = {},
): KnownAdditiveInfo {
  const copy = PURPOSE_COPY[category];
  return {
    keys: [code, displayName, ...extraKeys],
    code,
    displayName,
    category,
    purposeLabel: overrides.purposeLabel ?? copy.purpose,
    consumerSummary: overrides.consumerSummary ?? copy.summary,
    profile: overrides.profile ?? copy.profile,
  };
}

const KNOWN_ADDITIVES: KnownAdditiveInfo[] = [
  knownE("E100", "커큐민", "colorant", ["CURCUMIN"]),
  knownE("E101", "리보플라빈", "colorant", ["RIBOFLAVIN"]),
  knownE("E102", "타르트라진", "colorant", ["TARTRAZINE", "식용색소황색4호"]),
  knownE("E104", "퀴놀린 옐로", "colorant", ["QUINOLINEYELLOW"]),
  knownE("E110", "선셋옐로 FCF", "colorant", ["SUNSETYELLOWFCF", "식용색소황색5호"]),
  knownE("E120", "코치닐/카민", "colorant", ["COCHINEAL", "CARMINES"]),
  knownE("E122", "아조루빈", "colorant", ["AZORUBINE", "CARMOISINE"]),
  knownE("E124", "폰소 4R", "colorant", ["PONCEAU4R"]),
  knownE("E127", "에리트로신", "colorant", ["ERYTHROSINE", "식용색소적색3호"]),
  knownE("E129", "알루라 레드 AC", "colorant", ["ALLURAREDAC", "식용색소적색40호"]),
  knownE("E131", "페이턴트 블루 V", "colorant", ["PATENTBLUEV"]),
  knownE("E132", "인디고틴", "colorant", ["INDIGOTINE", "INDIGOCARMINE"]),
  knownE("E133", "브릴리언트 블루 FCF", "colorant", ["BRILLIANTBLUEFCF", "식용색소청색1호"]),
  knownE("E141", "클로로필 구리복합체", "colorant", ["COPPERCHLOROPHYLL"]),
  knownE("E142", "그린 S", "colorant", ["GREENS", "식용색소녹색3호"]),
  knownE("E150A", "카라멜색소 I", "colorant", ["PLAINCARAMEL", "CARAMELCOLOR"]),
  knownE("E150B", "카라멜색소 II", "colorant", ["CAUSTICSULPHITECARAMEL"]),
  knownE("E150C", "카라멜색소 III", "colorant", ["AMMONIACARAMEL"]),
  knownE("E150D", "카라멜색소 IV", "colorant", ["SULPHITEAMMONIACARAMEL"]),
  knownE("E160A", "카로틴류", "colorant", ["CAROTENES"]),
  knownE("E160B", "안나토", "colorant", ["ANNATTO"]),
  knownE("E171", "이산화티타늄", "colorant", ["TITANIUMDIOXIDE"], {
    consumerSummary:
      "흰색을 내는 착색료로 쓰였지만 EFSA 2021 안전성 재평가 이슈가 있어 강한 주의 대상으로 표시합니다.",
  }),

  knownE("E200", "소브산", "preservative", ["SORBICACID"]),
  knownE("E202", "소브산칼륨", "preservative", ["POTASSIUMSORBATE"]),
  knownE("E210", "안식향산", "preservative", ["BENZOICACID"]),
  knownE("E211", "안식향산나트륨", "preservative", ["SODIUMBENZOATE"]),
  knownE("E249", "아질산칼륨", "preservative", ["POTASSIUMNITRITE"], {
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 첨가물입니다. 허용량과 총 노출량 관리가 필요한 항목입니다.",
  }),
  knownE("E250", "아질산나트륨", "preservative", ["SODIUMNITRITE"], {
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 첨가물입니다. 허용량과 총 노출량 관리가 필요한 항목입니다.",
  }),
  knownE("E251", "질산나트륨", "preservative", ["SODIUMNITRATE"], {
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 첨가물입니다. 허용량과 총 노출량 관리가 필요한 항목입니다.",
  }),
  knownE("E252", "질산칼륨", "preservative", ["POTASSIUMNITRATE"], {
    purposeLabel: "발색·보존",
    consumerSummary:
      "주로 육가공품의 색과 보존성을 유지하는 첨가물입니다. 허용량과 총 노출량 관리가 필요한 항목입니다.",
  }),
  knownE("E280", "프로피온산", "preservative", ["PROPIONICACID"]),
  knownE("E281", "프로피온산나트륨", "preservative", ["SODIUMPROPIONATE"]),
  knownE("E282", "프로피온산칼슘", "preservative", ["CALCIUMPROPIONATE"]),

  knownE("E300", "아스코르브산", "antioxidant", ["ASCORBICACID"]),
  knownE("E306", "토코페롤 추출물", "antioxidant", ["TOCOPHEROLRICH EXTRACT", "TOCOPHEROLS"]),
  knownE("E307", "알파-토코페롤", "antioxidant", ["ALPHATOCOPHEROL"]),
  knownE(
    "E319",
    "TBHQ(터셔리부틸히드로퀴논)",
    "antioxidant",
    ["TBHQ", "터셔리부틸히드로퀴논", "TERTIARYBUTYLHYDROQUINONE"],
    {
      purposeLabel: "기름 산패 방지",
      consumerSummary:
        "튀김·스낵류의 기름이 산패되는 것을 늦추는 산화방지제입니다. 제품 함량 없이는 섭취 위험을 확정할 수 없습니다.",
      profile: {
        ...RISK_META.limited_risk,
        basis: "EFSA/JECFA 일일섭취허용량(ADI) 0.7 mg/kg bw 기준이 있는 산화방지제",
      },
    },
  ),
  knownE("E320", "BHA(부틸히드록시아니솔)", "antioxidant", ["BHA", "BUTYLATEDHYDROXYANISOLE"], {
    purposeLabel: "기름 산패 방지",
  }),
  knownE("E321", "BHT(부틸히드록시톨루엔)", "antioxidant", ["BHT", "BUTYLATEDHYDROXYTOLUENE"], {
    purposeLabel: "기름 산패 방지",
  }),

  knownE("E270", "젖산", "acidity_regulator", ["LACTICACID"]),
  knownE("E296", "말산", "acidity_regulator", ["MALICACID"]),
  knownE("E330", "구연산", "acidity_regulator", ["CITRICACID"]),
  knownE("E331", "구연산나트륨", "acidity_regulator", ["SODIUMCITRATES"]),
  knownE("E334", "주석산", "acidity_regulator", ["TARTARICACID"]),
  knownE("E338", "인산", "acidity_regulator", ["PHOSPHORICACID"], {
    profile: RISK_META.limited_risk,
  }),
  knownE("E339", "인산나트륨", "acidity_regulator", ["SODIUMPHOSPHATES"], {
    profile: RISK_META.limited_risk,
  }),
  knownE(
    "E500",
    "탄산나트륨류",
    "acidity_regulator",
    ["SODIUMCARBONATES", "SODIUMBICARBONATE", "탄산수소나트륨"],
    {
      purposeLabel: "산도 조절·팽창 보조",
      consumerSummary: "산도를 조절하거나 반죽이 부풀도록 돕는 탄산나트륨 계열 첨가물입니다.",
    },
  ),

  knownE("E551", "이산화규소", "anticaking_agent", ["SILICONDIOXIDE", "SILICA"], {
    profile: {
      ...RISK_META.risk_free,
      basis: "식품첨가물공전 사용기준상 고결방지제·거품제거제·여과보조제 목적 사용",
    },
  }),

  knownE("E620", "글루탐산", "flavor", ["GLUTAMICACID"]),
  knownE("E621", "글루탐산나트륨(MSG)", "flavor", ["MSG", "MONOSODIUMGLUTAMATE"]),
  knownE("E627", "구아닐산이나트륨", "flavor", ["DISODIUMGUANYLATE"]),
  knownE("E631", "이노신산이나트륨", "flavor", ["DISODIUMINOSINATE"]),
  knownE("E635", "5'-리보뉴클레오티드이나트륨", "flavor", ["DISODIUM5RIBONUCLEOTIDES"]),

  knownE("E950", "아세설팜칼륨", "sweetener", ["ACESULFAMEK", "아세설팜K"]),
  knownE("E951", "아스파탐", "sweetener", ["ASPARTAME"]),
  knownE("E952", "사이클라메이트", "sweetener", ["CYCLAMATES"]),
  knownE("E954", "사카린", "sweetener", ["SACCHARIN", "사카린나트륨"]),
  knownE("E955", "수크랄로스", "sweetener", ["SUCRALOSE"]),
  knownE("E960", "스테비올배당체", "sweetener", ["STEVIOLGLYCOSIDES", "STEVIA"]),
  knownE("E967", "자일리톨", "sweetener", ["XYLITOL"]),
  knownE("E968", "에리스리톨", "sweetener", ["ERYTHRITOL"]),
];

const RISK_RULES: { patterns: string[]; profile: AdditiveRiskProfile }[] = [
  {
    patterns: ["E171", "이산화티타늄", "TITANIUMDIOXIDE"],
    profile: {
      ...RISK_META.high_risk,
      basis: "EFSA 2021 E171 안전성 재평가 근거",
    },
  },
  {
    patterns: [
      "E249",
      "E250",
      "E251",
      "E252",
      "아질산나트륨",
      "아질산칼륨",
      "질산나트륨",
      "질산칼륨",
      "SODIUMNITRITE",
      "POTASSIUMNITRITE",
      "SODIUMNITRATE",
      "POTASSIUMNITRATE",
    ],
    profile: {
      ...RISK_META.high_risk,
      basis: "아질산염/질산염 허용량 및 노출량 관리 대상",
    },
  },
  {
    patterns: [
      "식용색소",
      "타르색소",
      "TARTRAZINE",
      "안식향산",
      "SODIUMBENZOATE",
      "사카린",
      "SACCHARIN",
      "아스파탐",
      "ASPARTAME",
      "수크랄로스",
      "SUCRALOSE",
      "E102",
      "E104",
      "E110",
      "E122",
      "E124",
      "E127",
      "E129",
      "E211",
      "E951",
      "E954",
      "E955",
    ],
    profile: RISK_META.moderate_risk,
  },
  {
    patterns: [
      "아세설팜",
      "합성향료",
      "바닐린",
      "프로피온산",
      "E950",
      "E280",
      "E281",
      "E282",
      "E621",
    ],
    profile: RISK_META.limited_risk,
  },
  {
    patterns: [
      "구연산",
      "구연산나트륨",
      "젖산",
      "말산",
      "천연향료",
      "E270",
      "E296",
      "E330",
      "E331",
      "E334",
      "E500",
    ],
    profile: RISK_META.risk_free,
  },
];

const CATEGORY_FALLBACK_RISK: Record<AdditiveCategory, AdditiveRiskProfile> = {
  sweetener: RISK_META.limited_risk,
  preservative: RISK_META.limited_risk,
  antioxidant: RISK_META.limited_risk,
  colorant: RISK_META.limited_risk,
  acidity_regulator: RISK_META.risk_free,
  stabilizer: RISK_META.risk_free,
  anticaking_agent: RISK_META.risk_free,
  flavor: RISK_META.limited_risk,
  unknown: RISK_META.unknown,
};

function normalizeAdditive(additive: string) {
  return additive
    .replace(/^EN:/i, "")
    .replace(/[-_\s]/g, "")
    .trim()
    .toUpperCase();
}

function matchesPattern(additive: string, pattern: string) {
  const normalized = normalizeAdditive(additive);
  const normalizedPattern = normalizeAdditive(pattern);
  return normalized === normalizedPattern || normalized.includes(normalizedPattern);
}

export function findAdditiveRiskProfile(rawName: string): AdditiveRiskProfileSeed | undefined {
  return ADDITIVE_RISK_PROFILE_SEEDS.find((profile) =>
    [profile.canonicalName, profile.eNumber, profile.insNumber, ...profile.aliases]
      .filter((value): value is string => Boolean(value))
      .some((key) => matchesPattern(rawName, key)),
  );
}

function riskProfileFromSeed(profile: AdditiveRiskProfileSeed): AdditiveRiskProfile {
  const meta = RISK_META[profile.riskLevel];
  return {
    ...meta,
    scorePenalty: profile.scorePenalty,
    scoreCap: profile.scoreCap ?? meta.scoreCap,
    reviewRequired: profile.reviewRequired,
    basis: profile.basisKo,
    sourceUrls: profile.sourceUrls,
    evidenceLevel: profile.evidenceLevel,
  };
}

function knownAdditiveInfoOf(rawName: string) {
  return KNOWN_ADDITIVES.find((additive) =>
    additive.keys.some((key) => matchesPattern(rawName, key)),
  );
}

function categoryOf(rawName: string): AdditiveCategory {
  const seeded = findAdditiveRiskProfile(rawName);
  if (seeded) return seeded.category;

  const known = knownAdditiveInfoOf(rawName);
  if (known) return known.category;

  const normalized = normalizeAdditive(rawName);

  for (const [key, category] of Object.entries(ADDITIVE_MAP)) {
    if (normalizeAdditive(key) === normalized || matchesPattern(rawName, key)) {
      return category;
    }
  }

  const eNumberMatch = normalized.match(/^E\d{3,4}[A-Z]?$/);
  if (eNumberMatch) {
    const eNum = Number.parseInt(normalized.slice(1), 10);
    if (eNum >= 100 && eNum <= 199) return "colorant";
    if (eNum >= 200 && eNum <= 299) return "preservative";
    if (eNum >= 300 && eNum <= 399) return "acidity_regulator";
    if (eNum >= 600 && eNum <= 699) return "flavor";
    if (eNum >= 950 && eNum <= 969) return "sweetener";
  }

  return "unknown";
}

export function additiveRiskProfileOf(rawName: string): AdditiveRiskProfile {
  const seeded = findAdditiveRiskProfile(rawName);
  if (seeded) return riskProfileFromSeed(seeded);

  for (const rule of RISK_RULES) {
    if (rule.patterns.some((pattern) => matchesPattern(rawName, pattern))) {
      return rule.profile;
    }
  }

  const known = knownAdditiveInfoOf(rawName);
  if (known) {
    const knownRiskKeys = [known.code, known.displayName].filter(Boolean) as string[];
    for (const rule of RISK_RULES) {
      if (
        knownRiskKeys.some((key) => rule.patterns.some((pattern) => matchesPattern(key, pattern)))
      ) {
        return rule.profile;
      }
    }
    return known.profile;
  }

  return CATEGORY_FALLBACK_RISK[categoryOf(rawName)];
}

export function classifyAdditive(rawName: string): ClassifiedAdditive {
  const seeded = findAdditiveRiskProfile(rawName);
  const known = knownAdditiveInfoOf(rawName);
  const category = categoryOf(rawName);
  const categoryMeta = CATEGORY_META[category];
  const risk = additiveRiskProfileOf(rawName);
  const sourceUrls = risk.sourceUrls ?? [];
  const evidenceLevel =
    risk.evidenceLevel ?? (risk.reviewRequired ? "unmatched" : "safety_evaluated");

  return {
    name: rawName,
    code: known?.code ?? seeded?.eNumber,
    displayName: known?.displayName ?? seeded?.canonicalName ?? rawName,
    purposeLabel: known?.purposeLabel ?? seeded?.purposeLabel ?? categoryMeta.label,
    consumerSummary: known?.consumerSummary ?? seeded?.consumerSummary ?? risk.basis,
    explanationSource: known || seeded ? "dictionary" : "fallback",
    category,
    categoryLabel: categoryMeta.label,
    severity: risk.severity,
    riskLevel: risk.level,
    riskLabel: risk.label,
    riskBasis: risk.basis,
    scorePenalty: risk.scorePenalty,
    scoreCap: risk.scoreCap,
    reviewRequired: risk.reviewRequired,
    sourceUrls,
    evidenceLevel,
  };
}

export function classifyAdditives(
  additives: string[],
): Map<AdditiveCategory, ClassifiedAdditive[]> {
  const grouped = new Map<AdditiveCategory, ClassifiedAdditive[]>();

  for (const additive of additives) {
    const classified = classifyAdditive(additive);
    const existing = grouped.get(classified.category) ?? [];
    existing.push(classified);
    grouped.set(classified.category, existing);
  }

  return grouped;
}

export const CATEGORY_ORDER: AdditiveCategory[] = [
  "sweetener",
  "preservative",
  "antioxidant",
  "colorant",
  "acidity_regulator",
  "stabilizer",
  "anticaking_agent",
  "flavor",
  "unknown",
];

export function getCategoryMeta(cat: AdditiveCategory) {
  return CATEGORY_META[cat];
}

export function getRiskMeta(level: AdditiveRiskLevel) {
  return RISK_META[level];
}

export function getUnknownAdditives(additives: string[]): string[] {
  return additives
    .map((additive) => classifyAdditive(additive))
    .filter((additive) => additive.reviewRequired)
    .map((additive) => additive.name);
}
