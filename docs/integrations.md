# 외부 API 연동 설정

## 관련 기준

- [식품 점수 정책](./food-scoring-policy.md)
- [데이터 신뢰도 정책](./data-trust-policy.md)

## 원칙

- 비공개 키는 브라우저 번들에 노출하지 않는다.
- `FOOD_SAFETY_API_KEY`, `PUBLIC_DATA_API_KEY`, `GEMINI_API_KEY`, `NAVER_SHOPPING_CLIENT_ID`, `NAVER_SHOPPING_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function secrets로 등록한다.
- 브라우저에는 Edge Function 호출에 필요한 Supabase URL, project id, anon key만 `VITE_*` 변수로 노출한다.
- `supabase/functions/app-api`는 모든 외부 API 호출을 단일 Edge Function action으로 중계한다.
- `app-api` 내부 구현은 `_shared/` 공통 모듈과 `actions/` 도메인 모듈로 분리한다. 세부 구조는 [Edge Function 구조](./edge-function-architecture.md)를 따른다.
- `ocr-*` ID는 로컬 OCR 임시 제품 식별자이므로 바코드 기반 외부 연동(C005, I2570, Open Food Facts, Supabase verified lookup)의 입력으로 사용하지 않는다.
- Open Food Facts 바코드 단건 조회는 `/api/v0/product/{barcode}.json`을 사용한다. v2 단건 조회는 미등록 바코드에서 HTTP 404를 반환해 브라우저 콘솔에 네트워크 오류를 남기지만, v0는 HTTP 200과 `status: 0`으로 미등록 상태를 구분할 수 있다.
- 클라이언트의 Open Food Facts 바코드 조회와 상품명 검색은 브라우저에서 직접 호출하지 않고 `lookupOpenFoodFactsByBarcode`, `searchOpenFoodFacts` Edge Function action을 통해 호출한다. 직접 호출은 CORS 차단과 외부 5xx 콘솔 오류를 만든다.

## 환경 변수

| 이름                           | 용도                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| `FOOD_SAFETY_API_KEY`          | 식품안전나라 C005, I2570, I1250, C002, C006, I0490, I2520, I0950 호출 |
| `PUBLIC_DATA_API_KEY`          | 공공데이터포털 영양성분 표준데이터, 식품 원재료 정보 REST API, HACCP 제품이미지 및 포장지표기정보 API 호출 |
| `GEMINI_API_KEY`               | Gemini OCR, 제품 정보 구조화, 바코드 후보 선택, 대체상품 적합도 판정, 함께 먹기 좋은 조합 추천, 첨가물 전문용어 표시용 해석 |
| `GEMINI_OCR_MODEL`             | OCR, 바코드 후보 선택, 대체상품 적합도 판정, 함께 먹기 좋은 조합 추천, 첨가물 해석 모델명. 기본값 `gemini-3-flash-preview` |
| `NAVER_SHOPPING_CLIENT_ID`     | 네이버 쇼핑 검색 API Client ID                                      |
| `NAVER_SHOPPING_CLIENT_SECRET` | 네이버 쇼핑 검색 API Client Secret                                  |
| `SUPABASE_URL`                 | Edge Function 내부 Supabase REST URL 파생용                         |
| `SUPABASE_PROJECT_ID`          | Supabase project ref                                                |
| `SUPABASE_REST_URL`            | Supabase REST API URL                                               |
| `SUPABASE_ANON_KEY`            | 공개 조회 fallback 및 브라우저 `apikey` 헤더                        |
| `SUPABASE_SERVICE_ROLE_KEY`    | Edge Function 내부 DB 쓰기용 service role key                       |
| `VITE_SUPABASE_URL`            | 브라우저 Edge Function URL 파생용 공개 URL                          |
| `VITE_SUPABASE_PROJECT_ID`     | 브라우저 Edge Function URL 파생용 project ref                       |
| `VITE_SUPABASE_FUNCTIONS_URL`  | 브라우저 Edge Function base URL                                     |
| `VITE_SUPABASE_ANON_KEY`       | 브라우저가 `apikey` 헤더로 전송할 anon key                          |
| `ADMIN_ACCESS_CODE`            | 관리자 action 접근 코드                                             |

## 구현된 Edge Function action

| action                        | 외부 API                                           | 기능                                                                   |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `lookupC005`                  | 식품안전나라 C005                                  | 바코드 기반 제품 보조 식별                                             |
| `lookupI2570`                 | 식품안전나라 I2570                                 | 유통바코드 기반 구 바코드 보조 식별                                    |
| `searchI1250`                 | 식품안전나라 I1250                                 | 품목제조보고 기반 제품 기본정보 검색                                   |
| `lookupC002`                  | 식품안전나라 C002                                  | 식품(첨가물) 품목제조보고 원재료 조회                                  |
| `lookupI0490`                 | 식품안전나라 I0490                                 | 회수·판매중지 이력 조회                                                |
| `lookupNutritionStandard`     | Supabase `nutrition_products` + 공공데이터 API     | 품목제조보고번호 또는 제품명 기반 영양성분 보강                        |
| `searchAlternativeCandidates` | Supabase `nutrition_products` + 식품안전나라 I0490 | 같은 식품군의 점수 산출 가능 대체 후보 조회, 상위 후보 회수 이력 보강  |
| `recommendAlternativeProducts` | Gemini API                                         | 공공 DB/API 후보 중 현재 제품의 실제 대체상품을 의미·영양 개선 기준으로 랭킹 |
| `recommendAlternativeShoppingSearches` | Gemini API                                | 점수형 후보가 없을 때 현재 제품의 영양 부담을 해석해 네이버쇼핑 검색어 생성 |
| `verifyAlternativeShoppingResults` | Gemini API                                   | 네이버쇼핑 상위 결과 중 실제 영양 대체식품으로 볼 수 있는 상품 재검증 |
| `recommendFoodPairings`       | Gemini API                                         | 현재 제품 영양성분을 기준으로 함께 먹기 좋은 일반 식품 조합 추천       |
| `lookupIngredientInfo`        | 공공데이터 식품 원재료 정보 + 식품안전나라 I2520   | 원재료 대분류/중분류/코드 보강                                         |
| `lookupAdditiveInfo`          | 식품안전나라 I0950 + 원재료 분류                   | 식품첨가물 기준규격 보강                                               |
| `explainAdditiveTerms`        | Gemini API                                         | 사전에 없는 첨가물 코드·전문용어의 표시용 한국어 설명 생성             |
| `lookupOpenFoodFactsByBarcode` | Open Food Facts                                    | 바코드 기반 공개 DB 제품 이미지 보강                                   |
| `searchOpenFoodFacts`         | Open Food Facts                                    | 서버 경유 대체상품 후보 검색                                           |
| `searchNaverShopping`         | 네이버 쇼핑 검색 API                               | 점수 후보의 구매 가능성, 가격 텍스트, 판매처, 상품 링크 보강           |
| `analyzeFoodImage`            | Gemini API                                         | 서버 OCR 구조화 기능. 현재 스캔 UI에서는 호출하지 않음                 |
| `selectBestProductCandidate`  | Gemini API                                         | 자체 DB, 공공데이터, 공개 DB 후보를 모두 조회한 뒤 최종 제품 후보 선택 |
| `translateProductToKorean`    | Gemini API                                         | 외국어 상품명, 원재료, 알레르기, 카테고리의 한국어 표시용 번역          |
| `enrichProduct`               | 위 API 조합                                        | 원재료, 영양성분, 첨가물, 회수 이력 통합 보강                          |

`enrichProduct`는 품목제조보고번호가 있으면 먼저 한국식품안전관리인증원 HACCP 제품이미지 및 포장지표기정보 API(`CertImgListServiceV3`)로 포장지 표기 원재료, 알레르기, 제품 이미지를 보강한다. 포장지 원재료가 더 상세하거나 기존 원재료에 `식품첨가물` 같은 포괄 표기가 있고 포장지 원재료에는 없으면 포장지 값을 우선 사용한다.

`lookupC005`는 `C005.INDUTY_NM`이 축산물 계열이면 내부적으로 `C006` 축산물품목제조보고(원재료)를 우선 조회한다. 일반 식품 후보는 `C002`를 우선 사용하며, 우선 원재료 API가 비면 다른 원재료 API를 fallback으로 조회한다.

Gemini REST 요청은 `generationConfig.responseMimeType`과 `generationConfig.responseSchema`를 사용한다. `generationConfig.responseFormat` 래퍼는 Gemini REST API 필드가 아니므로 사용하지 않는다.

`recommendAlternativeProducts`는 후보를 생성하지 않는다. 클라이언트가 `searchAlternativeCandidates`로 받은 공공 영양 DB 후보 목록을 넘기면 Gemini는 `productId`, `fitScore`, `substituteGroup`, `reason`만 포함한 추천 순서를 반환한다. 기본 상품명·카테고리 키워드로 Open Food Facts 후보를 채우는 fallback은 사용하지 않는다. 최종 추천 점수 계산, 회수 이력 제외, B등급 이상 필터, 가격 표시 보강은 기존 deterministic 로직이 처리한다.

`recommendAlternativeShoppingSearches`는 공공 영양 DB 기반 점수형 후보가 없을 때 호출한다. Gemini는 현재 제품의 영양 부담을 해석해 네이버쇼핑 검색어, 대체 식품 컨셉, 영양 개선 방향만 반환한다. `verifyAlternativeShoppingResults`는 네이버쇼핑 상위 결과를 다시 Gemini에 전달해 원상품, 관련 없는 상품, 보충제·의약품·비식품을 제외하고 실제 영양 대체식품 후보만 통과시킨다. 실제 표시 상품, 가격, 이미지, 판매처, 링크는 `searchNaverShopping` 결과만 사용한다. 이후 `searchOpenFoodFacts`는 통과 상품의 영양성분 보조 검증에만 사용하며, 매칭과 점수 기준을 통과한 경우에만 참고 점수와 등급을 표시한다.

대체상품용 Gemini action(`recommendAlternativeProducts`, `recommendAlternativeShoppingSearches`, `verifyAlternativeShoppingResults`)은 Gemini 429 또는 5xx 응답을 Edge Function 503으로 전파하지 않고 빈 추천 결과를 반환한다. 이 단계는 선택 기능이므로 모델 과부하가 제품 상세 조회 자체를 실패시키면 안 된다.

Open Food Facts 상품명 검색(`searchOpenFoodFacts`)은 네이버쇼핑 통과 상품의 영양성분 보조 검증에만 사용한다. Open Food Facts 바코드 조회(`lookupOpenFoodFactsByBarcode`)도 공개 DB 보조 후보다. 바코드 조회 후보는 후보 선택 전에 `enrichProduct`를 거쳐 `nutrition_products` 제품명·제조사 매칭으로 영양성분을 보강할 수 있다. 제품명이 넓으면 기존 후보의 열량·당류·단백질 유사도와 원재료 맛 힌트를 랭킹에 반영한다. 이 보강은 Open Food Facts 값을 새로 생성하지 않으며, 원본 영양 DB의 실제 행만 병합한다. 두 action 모두 Open Food Facts 429 또는 5xx 응답과 네트워크 예외를 Edge Function 오류로 전파하지 않는다. 상품명 검색은 빈 결과, 바코드 조회는 `null`로 처리한다.

`recommendFoodPairings`는 제품명, 영양성분, 원재료, 알레르기, 첨가물, 출처 신뢰도만 입력으로 사용한다. Gemini는 브랜드 상품이나 구매 링크를 생성하지 않고 일반 식품 조합, 영양학적 근거, 주의 문구만 반환한다. 영양성분 값이 전혀 없으면 클라이언트는 Gemini를 호출하지 않는다.

`explainAdditiveTerms`는 로컬 첨가물 사전에 없는 항목만 입력으로 사용한다. Gemini는 일반명, 사용 목적, 한 문장 설명만 반환하며 안전성 판정, 위험도, 점수, 허용·금지 여부를 반환하지 않는다. 클라이언트는 결과를 `AI 해석`으로 표시하고 점수 계산에는 사용하지 않는다.

## 첨가물 위험도 DB

- `public.additive_risk_profiles`는 첨가물 표준명, alias, E-number, INS number, 위험도, 감점, 근거 URL을 저장한다.
- 초기 시드는 `supabase/migrations/20260515053717_additive_risk_profiles.sql`에 포함한다.
- 클라이언트 점수 계산은 동일 기준을 미러링한 `src/lib/additive-dictionary.ts`를 사용한다.
- 외부 데이터는 위험도 후보 근거로만 사용한다. Open Food Facts, HACCP, 식품안전나라 API, Gemini 응답만으로 위험도를 확정하지 않는다.
- 주요 공식 근거는 Codex GSFA, WHO/JECFA, EFSA OpenFoodTox, EU Food Additives Database, FDA SAF, Health Canada Additives DB다.

## 로컬 영양 DB

- `public/20260402_가공식품_268422건.xlsx`는 앱 런타임에서 직접 읽지 않는다.
- `scripts/import_nutrition_db.py`로 필요한 컬럼만 `nutrition_products`에 적재한다.
- `enrichProduct`는 영양성분 보강 시 `nutrition_products`를 먼저 조회하고, 실패할 때만 공공데이터포털 영양성분 API를 호출한다. C005/I2570이 비고 Open Food Facts에서 제품명만 확인된 바코드도 동일 보강 경로를 탄다.
- 제품명이 제조사/브랜드명을 접두어로 반복하면 해당 접두어를 제거한 정규화 제품명도 보조 매칭한다.
- `searchAlternativeCandidates`는 공공 품목 API의 제품 `category`를 우선 조회하고, 점수 산출은 클라이언트의 독립 점수 정책으로 수행한다. 영양 DB의 `category`가 제품 `category`와 충돌하면 영양 DB `category`는 대체상품 후보 검색에 사용하지 않는다.
- 바코드 컬럼은 원본 영양 DB에 없으므로 C005/I2570에서 얻은 `품목제조보고번호`가 1차 매칭 키다.
- 세부 절차는 [로컬 영양 DB 적재 기준](./local-nutrition-db.md)을 따른다.

## 현재 로컬 검증 결과

- `PUBLIC_DATA_API_KEY`로 영양성분 표준데이터 호출 정상.
- `PUBLIC_DATA_API_KEY`로 식품 원재료 정보 REST API 호출 정상.
- `PUBLIC_DATA_API_KEY`로 HACCP 제품이미지 및 포장지표기정보 API 호출 정상. `2002046408866`은 C002보다 상세한 포장지 원재료 문자열을 반환한다.
- `public/20260402_가공식품_268422건.xlsx`에서 바코드 `8801019314056`의 C005 품목제조보고번호 `19950144120110`이 `계란과자` 영양성분으로 매칭됨.
- 현재 `.env.local`의 `FOOD_SAFETY_API_KEY`로 C005, C006, I2520 호출 정상. `88002798`은 C005에서 `빙그레 바나나맛 우유`를 반환하고, C006에서 `정제수, 카로틴, 향료, 향료, 바나나농축과즙, 설탕, 원유` 원재료를 반환한다.
- 2026-05-14 기준 바코드 `8801037088182` 확인 결과 C005는 `오레오 초콜릿 샌드위치 쿠키`, C002는 원재료 목록, Open Food Facts는 이미지 없음, 네이버 쇼핑은 HTTP 200과 상품 이미지 URL을 반환한다.
- Supabase 원격 `app-api` Edge Function은 배포되어 있어야 한다. 미배포 상태에서는 브라우저 호출이 404 `Requested function was not found`로 실패한다.

## 네이버쇼핑 가격 연동

- 공식 검색 API의 쇼핑 엔드포인트는 `GET https://openapi.naver.com/v1/search/shop.json`이다.
- Edge Function은 `query`, `display`, `sort=sim`, `exclude=used:rental:cbshop`을 쿼리스트링으로 전달한다.
- 인증 헤더는 `X-Naver-Client-Id`, `X-Naver-Client-Secret`만 서버에서 사용한다. 브라우저 번들에는 시크릿을 노출하지 않는다.
- 응답의 `lprice`, `hprice`, `mallName`, `link`, `productId`, `productType`은 `Product.shoppingOffer`로 정규화한다.
- 제품 이미지 우선순위는 기존 `Product.imageUrl` 또는 검증 DB `products.image_url`, Open Food Facts 바코드 이미지, 네이버 쇼핑 이름 매칭 썸네일 순서다.
- `enrichProduct`는 공공 품목 API에 제품 이미지가 없을 때 제품명·제조사에서 괄호 표기, 특수문자, 법인 표기를 제거한 검색어로 네이버 쇼핑 썸네일을 조회한다. 예: `신(辛)라면`, `(주)농심`은 `농심 신라면`과 `신라면` 검색으로 보강한다.
- 대체상품 추천은 카테고리 검색 결과만 재사용하지 않고 최종 추천 후보의 제품명으로 네이버 쇼핑을 한 번 더 조회해 `Product.imageUrl`과 `Product.shoppingOffer`를 보강한다.
- 네이버 쇼핑 썸네일은 화면 표시와 구매 가능성 보조 정보일 뿐 점수 산출 근거가 아니며 출처는 `shopping`으로 표시한다.

## 배포

로컬 실행:

```bash
supabase functions serve app-api --env-file .env.local
```

원격 배포:

```bash
supabase functions deploy app-api
supabase secrets set --env-file .env.local
```

현재 개발 환경에서는 Supabase CLI가 설치되어 있지 않으면 위 명령이 실행되지 않는다.
