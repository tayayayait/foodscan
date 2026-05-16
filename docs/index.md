# 프로젝트 문서

식품 전용 제품 스캔 앱의 구현 기준, 외부 연동, 검수 흐름을 정리한다.

## 기준 문서

- [식품 점수 정책](./food-scoring-policy.md) - Yuka 유사 식품 전용 점수 구조와 판정 기준
- [첨가물 위험도 정책](./additive-risk-policy.md) - 첨가물 분류, 위험도, 검수 큐 기준
- [개인 기준 정책](./personal-preferences-policy.md) - 성분 알림과 식이 선호
- [사용자 제보 품질 정책](./submission-quality-policy.md) - 수동 등록과 OCR 저장의 근거 품질 기준
- [기록 인사이트 정책](./history-insights-policy.md) - 스캔 기록 요약, 주의 제품 필터, 반복 위험 요인
- [저장 제품 정책](./saved-products-policy.md) - 북마크 제품 저장, 해제, 보관함 기준
- [안전 감시 정책](./safety-watch-policy.md) - 저장·최근·임시 제품의 회수, 성분 알림, 고위험 첨가물 감시 기준
- [데이터 신뢰도 정책](./data-trust-policy.md) - 출처, 검수 상태, AI 추정값 표시 기준
- [로컬 영양 DB 적재 기준](./local-nutrition-db.md) - 가공식품 영양성분 DB 적재와 조회 순서
- [로컬 데이터 이동 정책](./local-data-portability-policy.md) - 로컬 백업 JSON 내보내기와 가져오기 기준

## 구현 문서

- [외부 API 연동 설정](./integrations.md) - 식약처 공공데이터, Gemini, Supabase 연동
- [제품 조회 보강 정책](./product-lookup-enrichment.md) - C005 다중 후보, C002/C006 상세 원재료, I2520 첨가물 감지 기준
- [Edge Function 구조](./edge-function-architecture.md) - `app-api` 내부 모듈 구조와 action 분리 기준
- [관리자 검수 흐름](./admin-review.md) - 검수 건 조회, 승인, 반려 흐름
- [P1 UX 기능 상태](./p1-ux-features.md) - 검색, 제품 상세, 대체상품 기능 범위
- [홈 랜딩 및 앱 진입 흐름](./home-landing-flow.md) - `/` 랜딩 화면과 `/app` 식품 스캔 홈 진입 기준
