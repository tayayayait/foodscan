# 개인 기준 정책

마지막 업데이트: 2026-05-15

개인 기준은 제품 자체 점수를 바꾸지 않는다. 제품 점수는 공통 기준으로 계산하고, 사용자가 선택한 성분 알림과 식이 선호는 별도 개인 경고와 대체상품 필터에만 반영한다.

## 저장 항목

| 항목      | 저장 위치                      | 용도                                       |
| --------- | ------------------------------ | ------------------------------------------ |
| 성분 알림 | `kfs:prefs.foodAlerts`         | 선택 성분 포함 시 제품 상세에서 개인 경고  |
| 식이 선호 | `kfs:prefs.dietaryPreferences` | 식이 선호 충돌 경고와 대체상품 후보 필터링 |

저장값은 `normalizePreferences`에서 보정한다. 지원하지 않는 값과 중복 항목은 제거하고, 기존 `allergens` 저장값 중 지원 가능한 항목은 성분 알림으로 이관한다.

## 지원 항목

### 성분 알림

| 키         | 표시명   |
| ---------- | -------- |
| `gluten`   | 글루텐   |
| `lactose`  | 유당     |
| `sulfites` | 아황산류 |
| `soy`      | 대두     |
| `palm_oil` | 팜유     |

### 식이 선호

| 키           | 표시명        |
| ------------ | ------------- |
| `vegetarian` | 채식          |
| `vegan`      | 비건          |
| `pork_free`  | 돼지고기 제외 |

## 경고 규칙

- 라벨에 직접 표시된 성분 알림 매칭은 `blocking: true`, `danger`로 표시한다.
- 원재료 텍스트 기반 성분 알림 매칭은 `blocking: false`, `caution`으로 표시한다.
- `may contain traces of ...` 같은 미량 혼입 고지는 성분 알림 매칭에서 제외한다.
- 식이 선호 충돌은 `blocking: false`, `caution`으로 표시한다.
- 개인 기준 경고는 제품 점수를 감점하지 않는다.
- 대체상품 추천은 설정된 성분 알림 또는 식이 선호와 충돌하는 후보를 제외한다.

## 구현 위치

- 기준 정규화 및 요약: `src/lib/preferences.ts`
- 저장 및 읽기: `src/lib/storage.ts`
- 개인 경고 계산: `src/lib/score.ts`
- 추천 후보 필터: `src/lib/alternatives.ts`
- 기준 설정 화면: `src/routes/preferences.tsx` (`/settings`의 개인 기준 진입점에서 접근)
- 제품 상세 요약: `src/routes/product.$id.tsx`

## 관련 문서

- [식품 점수 정책](./food-scoring-policy.md)
- [데이터 신뢰도 정책](./data-trust-policy.md)
