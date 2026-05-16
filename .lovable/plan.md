
# 한국형 식품 스캔 분석 서비스 MVP

상세서를 모바일 우선 React 앱으로 구현합니다. UI는 스펙(색상/폰트/간격) 그대로, 바코드 스캔은 브라우저 카메라 + ZXing, 제품 데이터는 Open Food Facts 공개 API 실제 연동, 식약처/Gemini는 mock으로 처리합니다.

## 1. 디자인 토큰 (src/styles.css)

상세서 6장을 그대로 매핑:
- Primary `#0F766E`, primaryHover `#115E59`, primarySoft `#CCFBF1`
- Background `#F8FAFC` / surface `#FFFFFF` / subtle `#F1F5F9`
- Text primary `#111827`, secondary `#475569`, muted `#64748B`
- 상태 색상 5단계: good / normal / caution / danger / info
- Pretendard 웹폰트 CDN 로드, `font-variant-numeric: tabular-nums`
- 라운드 max 8px (카드/버튼), 999px (스캔 버튼·칩)
- shadow.card / shadow.modal
- 8px 그리드 spacing 토큰

## 2. 라우트 구조 (TanStack Start)

```
src/routes/
  __root.tsx          → AppShell (모바일 BottomNav / 데스크톱 Sidebar)
  index.tsx           → 홈
  scan.tsx            → 바코드/사진 스캔
  search.tsx          → 검색 결과 (?q=)
  product.$id.tsx     → 제품 결과
  history.tsx         → 최근 스캔
  preferences.tsx     → 관심 기준 설정
  settings.tsx        → 설정
  register.tsx        → 미식별 제품 등록
```

각 라우트는 자체 head() 메타.

## 3. 공통 컴포넌트 (src/components)

`AppShell`, `BottomNav`, `Sidebar`, `SearchInput`, `ScanActionCard`, `ProductCard`, `ProductHeader`, `ScoreBadge`, `RiskBanner` (회수/알레르기), `AttentionPoints`, `NutritionBarChart`, `IngredientTabs`, `SourceBadge`, `EmptyState`, `LoadingSteps` (단계형 로딩), `Chip`, `StatusBadge`.

스펙 8장의 규격(높이, 패딩, 색상, 터치 44px) 1:1 적용.

## 4. 데이터 계층 (src/lib)

- `lib/off.ts` — Open Food Facts 클라이언트
  - `getByBarcode(code)` → `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
  - `searchByName(q)` → `/cgi/search.pl?search_terms=...&json=1`
  - 한국어 필드 우선(`product_name_ko`), fallback en
- `lib/normalize.ts` — OFF/mock 응답 → 내부 Product 타입 정규화
- `lib/score.ts` — 스펙 11장 가중치/페널티 점수 산출
- `lib/nutrition.ts` — 스펙 9.4.9 기준치(낮음/보통/높음) 분류
- `lib/storage.ts` — localStorage: 최근 스캔(10개), 관심 기준, 알레르기
- `lib/mock-recall.ts` — 식약처 I0490 회수 mock
- `lib/types.ts` — Product, Source, Confidence, ProductStatus 등

조회 흐름은 `lib/lookup.ts` 단일 함수: 자체 DB(localStorage) → OFF → 실패시 not_found. 단계별 진행 상태를 React state로 노출해 LoadingSteps에 표시.

## 5. 바코드 스캔

- 패키지: `@zxing/browser`
- `components/BarcodeScanner.tsx` — `BrowserMultiFormatReader`로 비디오 스트림 디코딩
- 카메라 권한 상태(`camera_permission_required` / `camera_ready` / `detecting` / `barcode_detected` / `barcode_not_found`) 관리
- 가이드 박스 280×120, 외부 어두운 오버레이
- 인식 성공 시 `navigator.vibrate(50)` + `/product/{barcode}` 이동

사진 모드는 placeholder(촬영 후 "AI 처리는 곧 지원" mock 문구) — Gemini 미연동.

## 6. 제품 결과 화면

스펙 9.4 정보 우선순위:
1. RecallAlertBanner (mock 회수 데이터 매칭 시)
2. AllergyAlertBanner (사용자 알레르기 ∩ 원재료/알레르기 라벨)
3. ProductHeader
4. ScoreSummary (점수 산출 불가 시 fallback CTA)
5. AttentionPoints (최대 3개)
6. NutritionBarChart (열량/당류/나트륨/포화지방/단백질)
7. Tabs: 원재료 / 첨가물 / 알레르기 / 출처
8. AlternativeProducts (OFF 같은 카테고리 상위 3개)

데스크톱은 메인 + 320px 보조패널 2컬럼.

## 7. 관심 기준 / 알레르기

- 프리셋 칩 6개(기본/당류/나트륨/다이어트/아이간식/알레르기)
- 알레르기 18개 기본 항목 다중선택 칩
- 직접 입력(최대 20자, 10개)
- localStorage 저장 → 점수/경고에 즉시 반영

## 8. 미식별 제품 등록

조회 실패 → `/register?barcode=...`로 유도. 폼(제품명/제조사/바코드/용량/사진), 제출 시 localStorage에 `provisional` 상태로 저장 + 토스트 안내.

## 9. 접근성 (스펙 13장)

- 모든 아이콘 버튼 `aria-label`
- focus ring 3px `#99F6E4`
- 위험 표시는 색상 + 아이콘(AlertTriangle/OctagonAlert) + 텍스트 라벨 동시 사용
- `prefers-reduced-motion` 감지 → 카운트업/shimmer 비활성

## 10. 범위 제외 (다음 단계)

- 관리자 검수 대시보드 (9.7) — 별도 단계
- Gemini OCR/Search — mock UI만
- 식약처 공공 API — mock 데이터
- 인증/로그인 — 모든 데이터 localStorage

## 기술 세부사항

- 패키지 추가: `@zxing/browser`, `@zxing/library`
- Pretendard: `<link>` CDN (cdn.jsdelivr.net/gh/orioncactus/pretendard) → __root.tsx head links
- shadcn 기존 컴포넌트(button, tabs, dialog, sheet, sonner)는 variants 추가해 재사용
- Open Food Facts는 클라이언트에서 직접 fetch (CORS OK, 키 불필요), User-Agent 헤더 권장
- `routeTree.gen.ts`는 자동 생성 — 손대지 않음

이 1차 구현으로 홈 → 스캔 → 제품 결과까지 실사용 가능한 흐름이 완성됩니다.
