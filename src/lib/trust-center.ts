import type { SourceTag } from "./types";

export type TrustPrincipleKey =
  | "independent_scoring"
  | "no_sponsored_recommendations"
  | "unverified_labeling"
  | "no_commercial_sale"
  | "medical_disclaimer";

export interface TrustPrinciple {
  key: TrustPrincipleKey;
  title: string;
  body: string;
}

export interface DataSourceTier {
  key: SourceTag;
  label: string;
  source: string;
  scoreUse: string;
}

export interface LocalDataInventoryInput {
  recentCount: number;
  savedCount: number;
  provisionalCount: number;
  hasPreferences: boolean;
  ocrDraftCount: number;
  recentSearchCount: number;
}

export interface LocalDataInventoryItem {
  key: "recent" | "saved" | "provisional" | "preferences" | "ocrDrafts" | "recentSearches";
  label: string;
  countLabel: string;
  purpose: string;
  storage: "local";
  clearedByLocalReset: boolean;
}

export const TRUST_PRINCIPLES: TrustPrinciple[] = [
  {
    key: "independent_scoring",
    title: "독립 점수",
    body: "브랜드, 제조사, 광고주는 제품 점수와 판정에 영향을 줄 수 없습니다.",
  },
  {
    key: "no_sponsored_recommendations",
    title: "비후원 추천",
    body: "대체상품 추천은 점수와 위험 요인 개선 기준으로만 정렬하며 후원 상품을 포함하지 않습니다.",
  },
  {
    key: "unverified_labeling",
    title: "검수 전 표시",
    body: "AI OCR과 사용자 제보 데이터는 검수 완료 데이터처럼 표시하지 않습니다.",
  },
  {
    key: "no_commercial_sale",
    title: "기록 비판매",
    body: "개인정보와 스캔 이력은 상업적 목적으로 판매하거나 공유하지 않습니다.",
  },
  {
    key: "medical_disclaimer",
    title: "의학 판단 제외",
    body: "제품 정보는 의학적 진단을 대체하지 않으며 건강 우려가 있으면 전문가 확인이 필요합니다.",
  },
];

export function trustPrincipleByKey(key: TrustPrincipleKey) {
  return TRUST_PRINCIPLES.find((principle) => principle.key === key) ?? null;
}

export function dataSourceTiers(): DataSourceTier[] {
  return [
    {
      key: "verified",
      label: "검수 완료",
      source: "자체 검수 DB",
      scoreUse: "확정 평가",
    },
    {
      key: "public_api",
      label: "공공데이터",
      source: "식약처·공공 API",
      scoreUse: "확정 평가 가능",
    },
    {
      key: "open_db",
      label: "공개 DB",
      source: "Open Food Facts",
      scoreUse: "참고 평가",
    },
    {
      key: "ai_estimated",
      label: "AI 추정",
      source: "AI 구조화",
      scoreUse: "임시 평가",
    },
    {
      key: "user_submitted",
      label: "사용자 제보",
      source: "직접 등록",
      scoreUse: "검수 전 평가",
    },
  ];
}

const countLabel = (count: number) => `${Math.max(0, count)}개`;

export function buildLocalDataInventory(input: LocalDataInventoryInput): LocalDataInventoryItem[] {
  return [
    {
      key: "recent",
      label: "최근 스캔",
      countLabel: countLabel(input.recentCount),
      purpose: "최근 조회 제품과 기록 인사이트 표시",
      storage: "local",
      clearedByLocalReset: true,
    },
    {
      key: "saved",
      label: "저장 제품",
      countLabel: countLabel(input.savedCount),
      purpose: "북마크 보관함 표시",
      storage: "local",
      clearedByLocalReset: true,
    },
    {
      key: "provisional",
      label: "임시 제품",
      countLabel: countLabel(input.provisionalCount),
      purpose: "사용자 제보와 OCR 저장 제품 조회",
      storage: "local",
      clearedByLocalReset: true,
    },
    {
      key: "preferences",
      label: "개인 기준",
      countLabel: input.hasPreferences ? "설정됨" : "기본값",
      purpose: "알레르기, 영양 한도, 첨가물 경고 적용",
      storage: "local",
      clearedByLocalReset: true,
    },
    {
      key: "ocrDrafts",
      label: "임시 초안",
      countLabel: countLabel(input.ocrDraftCount),
      purpose: "기존 임시 등록 초안 보관",
      storage: "local",
      clearedByLocalReset: true,
    },
    {
      key: "recentSearches",
      label: "최근 검색어",
      countLabel: countLabel(input.recentSearchCount),
      purpose: "검색 입력 보조",
      storage: "local",
      clearedByLocalReset: true,
    },
  ];
}
