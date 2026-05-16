# Edge Function 구조

`supabase/functions/app-api`는 브라우저 공개 API 계약을 유지하면서 내부만 모듈로 분리한다. 프론트는 계속 `app-api` 단일 URL에 `{ action, payload }` 형태로 요청한다.

## 디렉터리

```txt
supabase/functions/app-api/
  index.ts
  _shared/
    runtime.ts
    types.ts
    supabase-rest.ts
    food-safety-api.ts
    public-data-api.ts
    normalizers.ts
  actions/
    admin.ts
    additive-explanations.ts
    alternative-fit.ts
    alternatives.ts
    catalog-search.ts
    enrichment.ts
    food-pairings.ts
    ingredients.ts
    nutrition.ts
    ocr.ts
    product-lookup.ts
    product-store.ts
    recall.ts
    review-queue.ts
```

## 책임

| 파일                         | 책임                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `index.ts`                   | CORS, HTTP method 처리, action routing                               |
| `_shared/runtime.ts`         | HTTP 오류, 입력 검증, 환경 변수, Gemini schema/prompt, 외부 URL 상수 |
| `_shared/types.ts`           | Edge Function 내부 공통 타입                                         |
| `_shared/supabase-rest.ts`   | Supabase REST 호출 공통화                                            |
| `_shared/food-safety-api.ts` | 식품안전나라 API 호출 공통화                                         |
| `_shared/public-data-api.ts` | 공공데이터포털 API 호출 공통화                                       |
| `_shared/normalizers.ts`     | 문자열, 숫자, 바코드, 제품 정규화                                    |
| `actions/additive-explanations.ts` | Gemini 기반 첨가물 코드·전문용어 표시용 설명 생성              |
| `actions/alternative-fit.ts` | Gemini 기반 대체상품 의미 적합도 판정                                |
| `actions/alternative-recommendations.ts` | Gemini 기반 점수형 대체 후보 랭킹, 네이버쇼핑 검색어 생성, 쇼핑 결과 재검증 |
| `actions/product-lookup.ts`  | C005, I2570, C002, C006, I1250 제품 조회                              |
| `actions/nutrition.ts`       | `nutrition_products` 및 공공 영양 API 조회                           |
| `actions/alternatives.ts`    | 대체상품 후보 조회                                                   |
| `actions/ingredients.ts`     | 원재료·첨가물 정보 조회                                              |
| `actions/catalog-search.ts`  | Open Food Facts, 네이버쇼핑 검색                                     |
| `actions/food-pairings.ts`   | Gemini 기반 함께 먹기 좋은 일반 식품 조합 추천                      |
| `actions/recall.ts`          | I0490 회수·판매중지 조회                                             |
| `actions/enrichment.ts`      | 제품 원재료, 영양성분, 첨가물, 회수 정보 통합 보강                   |
| `actions/ocr.ts`             | Gemini OCR 및 제품 후보 선택                                         |
| `actions/product-store.ts`   | 검증 제품 조회·저장                                                  |
| `actions/review-queue.ts`    | 검수 큐 등록·조회·승인·상태 변경                                     |
| `actions/admin.ts`           | 관리자 코드 검증                                                     |

## 분리 원칙

- 공개 엔드포인트는 `app-api` 하나로 유지한다.
- action 이름과 payload/response 계약은 변경하지 않는다.
- 외부 API 호출과 Supabase REST 호출은 `_shared`를 통해서만 수행한다.
- 신규 action은 `actions/`에 추가하고 `index.ts`의 switch에만 연결한다.
- OCR처럼 timeout, 권한, 비용 특성이 다른 기능만 추후 별도 Edge Function으로 물리 분리한다.
