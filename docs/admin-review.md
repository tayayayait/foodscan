# 관리자 검수 흐름

마지막 업데이트: 2026-05-13

## 관련 기준

- [데이터 신뢰도 정책](./data-trust-policy.md)
- [첨가물 위험도 정책](./additive-risk-policy.md)

## 구현 범위

- `/admin`에서 Supabase `review_queue`를 상태별로 조회한다.
- 상태 필터는 `미검수`, `검수 중`, `승인됨`, `반려`, `전체`를 제공한다.
- 목록 내부에서 출처, 위험 플래그, 정렬, 날짜 필터를 추가로 적용한다.
- 목록은 데스크톱에서 테이블, 모바일에서 카드 리스트로 표시한다.
- 상세 패널에서 제품명, 제조사, 바코드, 식품유형, 용량, 원재료를 수정할 수 있다.
- 승인 시 수정된 제품 스냅샷을 `products`에 `verified` 상태로 upsert하고, 검수 큐 상태를 `approved`로 변경한다.
- 반려 또는 검수 중 상태 변경은 `review_queue.status`를 갱신한다.

## 우선순위 기준

검수 목록의 기본 정렬은 우선순위순이다.

| 위험 플래그 | 우선순위 가중치 |
| --- | ---: |
| `recall` | 100 |
| `allergy` | 80 |
| `low_confidence` | 70 |
| `unknown_additive` | 55 |
| `nutrition_missing` | 45 |

`pending` 항목은 5점, `in_review` 항목은 2점을 추가한다. confidence가 0.7 미만이면 10점을 추가한다.

## 승인 조건

승인 버튼은 다음 조건을 만족할 때만 활성화한다.

- 제품명이 비어 있지 않다.
- 제조사 또는 출처가 하나 이상 있다.
- 바코드가 있으면 8-14자리 숫자다.
- 원재료 텍스트, 원재료 배열, 영양성분 중 하나 이상이 있다.

조건을 만족하지 않으면 상세 패널에 승인 불가 사유를 표시한다.

## 환경 조건

- `SUPABASE_REST_URL`과 `SUPABASE_ANON_KEY`가 필요하다.
- 운영 환경의 관리자 조회/승인에는 `SUPABASE_SERVICE_ROLE_KEY`가 필요하다.
- `/admin` 화면은 `supabase/functions/app-api` Edge Function action을 호출한다.
- 브라우저에는 `VITE_SUPABASE_URL` 또는 `VITE_SUPABASE_FUNCTIONS_URL`, `VITE_SUPABASE_ANON_KEY`가 필요하다.
- `/admin` 접근에는 Edge Function secret `ADMIN_ACCESS_CODE`가 필요하다.
- 서비스 키가 없으면 RLS 정책상 검수 큐 조회/승인이 실패하거나 빈 목록으로 보일 수 있다.

## 적용해야 할 DB 변경

마이그레이션 파일:

- `supabase/migrations/20260512102517_p0_core_tables.sql`

원격 DB 적용 명령:

```bash
npx supabase db push
```
