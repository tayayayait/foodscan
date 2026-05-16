import type { RecallInfo } from "./types";

// Mock 식약처 I0490 회수·판매중지 데이터
const RECALLS: Record<string, RecallInfo> = {
  // 예시 바코드: 실제 회수 사례 흉내
  "8801234567890": {
    reason: "이물 검출(금속)로 인한 자진 회수",
    company: "샘플식품",
    date: "2025.04.12",
    grade: "1등급",
  },
};

export function lookupRecall(barcode?: string): RecallInfo | undefined {
  if (!barcode) return undefined;
  return RECALLS[barcode];
}
