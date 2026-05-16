# 로컬 영양 DB 적재 기준

식품 점수 산출은 런타임 API 응답에만 의존하지 않는다. 식품의약품안전처 가공식품 영양성분 DB를 `nutrition_products` 테이블에 선적재하고, 바코드 조회로 얻은 품목제조보고번호 또는 제품명으로 우선 조회한다.

## 원본 파일

- 현재 파일: `public/20260402_가공식품_268422건.xlsx`
- 시트: `20260402_가공식품_268,422건`
- 행 수: 268,422건
- 기준일자: 2026-04-02
- 바코드 컬럼은 없다. 바코드는 식품안전나라 C005/I2570 또는 자체 캐시에서 제품 식별용으로만 사용한다.

## 적재 테이블

`supabase/migrations/20260514093000_nutrition_products.sql`은 `nutrition_products`를 생성한다.

핵심 컬럼:

- `food_code`
- `report_no`
- `name`
- `normalized_name`
- `manufacturer`
- `normalized_manufacturer`
- `category`
- `large_category`
- `representative_food`
- `small_category`
- `basis_amount`
- `serving_size`
- `food_weight`
- `energy_kcal`
- `sugars_g`
- `sodium_mg`
- `saturated_fat_g`
- `protein_g`
- `data_basis_date`

## Import

마이그레이션 적용 후 실행한다. 전체 Supabase 업서트에는 `.env.local` 또는 실행 환경에 `SUPABASE_SERVICE_ROLE_KEY`가 있어야 한다. anon key만으로는 `nutrition_products`에 쓰지 않는다.

```bash
python scripts/import_nutrition_db.py public/20260402_가공식품_268422건.xlsx --supabase
```

또는 고정 npm script를 사용한다. Windows 콘솔 인코딩 문제를 피하기 위해 npm script는 `public/20260402_*.xlsx`를 자동 탐색한다.

```bash
npm run import:nutrition-db
```

검증용 샘플 출력:

```bash
python scripts/import_nutrition_db.py public/20260402_가공식품_268422건.xlsx --dry-run
```

또는:

```bash
npm run import:nutrition-db:dry-run
```

CSV만 생성:

```bash
python scripts/import_nutrition_db.py public/20260402_가공식품_268422건.xlsx --csv tmp/nutrition_products.csv
```

## 조회 순서

`enrichProduct`는 영양성분 보강 시 다음 순서로 조회한다.

1. `nutrition_products.report_no` exact match
2. `nutrition_products.normalized_name` exact match
3. 제조사/브랜드 접두어를 제거한 `nutrition_products.normalized_name` exact match
4. `nutrition_products.normalized_name` partial match
5. 제조사/브랜드 접두어를 제거한 `nutrition_products.normalized_name` partial match
6. 공공데이터포털 영양성분 API fallback

`searchAlternativeCandidates`는 대체상품 추천 후보를 만들 때 다음 순서로 조회한다.

1. 현재 제품의 `report_no`로 원본 행을 찾고 `category`, `small_category`, `representative_food`를 확인
2. 공공 품목 API에서 온 현재 제품 `category`로 후보 조회
3. 영양 DB의 `small_category`, `representative_food`를 보조 조회
4. 영양 DB의 `category`가 현재 제품 `category`와 같거나 현재 제품 `category`가 없을 때만 영양 DB `category` 조회
5. 카테고리 후보가 부족하면 제품명 partial match 보조 조회. 이 조회는 후보 수집용이며 추천 통과 기준으로 쓰지 않음
6. 상위 후보 일부에 대해 I0490 회수·판매중지 이력 보강
7. 클라이언트는 후보 목록을 `recommendAlternativeProducts` Edge Function action으로 보내 Gemini 추천 순서와 실제 대체 가능성(`fitScore`)을 받은 뒤 최종 추천 점수 평가에 사용

바코드 `8801037088182`의 경우 C005 `category`는 `과자`지만 영양 DB `category`가 `빵류`로 매칭된다. 이처럼 카테고리가 충돌하면 `빵류` 후보를 먼저 추천하지 않고 C005의 `과자`를 우선한다.

예시:

```txt
8801019314056
-> 식품안전나라 C005: 품목제조보고번호 19950144120110
-> nutrition_products: 계란과자 영양성분 매칭
-> 점수 산출 가능
```

## 제한

- 제품명만으로 매칭하면 동명이품 가능성이 있다.
- 품목제조보고번호가 없는 바코드는 정확도가 낮아질 수 있다.
- 수입·리뉴얼 제품은 최신 바코드와 영양 DB가 불일치할 수 있다.
- 불일치가 의심되면 숫자 점수를 확정값처럼 표시하지 말고 검수 큐로 보낸다.
