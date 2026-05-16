# 로컬 데이터 이동 정책

마지막 업데이트: 2026-05-14

이 문서는 브라우저 `localStorage`에 저장된 식품 스캔 앱 데이터를 JSON 파일로 내보내고 다시 가져오는 기준을 정의한다.

## 대상 데이터

백업 파일은 다음 항목만 포함한다.

| 항목           | 저장 키               | 최대 개수 |
| -------------- | --------------------- | --------- |
| 최근 스캔 제품 | `kfs:recent`          | 10        |
| 저장 제품      | `kfs:saved-products`  | 50        |
| 임시 제품      | `kfs:provisional`     | 50        |
| 개인 기준      | `kfs:prefs`           | 1         |
| OCR 임시 초안  | `kfs:ocr-drafts`      | 5         |
| 최근 검색어    | `kfs:recent-searches` | 5         |

`ocr-*` ID는 바코드가 아니라 로컬 OCR 임시 제품 식별자다. 제품 상세 조회에서 이 ID는 `kfs:provisional` 등 로컬 저장소만 조회하고, 공공데이터 API나 Open Food Facts 바코드 API 호출 대상으로 사용하지 않는다.

서버 계정, 관리자 토큰, 외부 API 키, Supabase 세션 정보는 백업 대상이 아니다.

## 파일 형식

내보내기 파일은 UTF-8 JSON이며 앱 식별자와 스키마 버전을 포함한다.

```json
{
  "app": "food-scan",
  "version": 1,
  "exportedAt": "2026-05-13T02:03:04.000Z",
  "data": {
    "recent": [],
    "savedProducts": [],
    "provisional": [],
    "preferences": null,
    "ocrDrafts": [],
    "recentSearches": []
  }
}
```

파일명은 `food-scan-local-data-YYYYMMDD.json` 형식을 사용한다.

## 가져오기 검증

가져오기는 다음 조건을 만족해야 실행된다.

- JSON 파싱이 가능해야 한다.
- `app` 값이 `food-scan`이어야 한다.
- `version` 값이 `1`이어야 한다.
- `data`가 객체여야 한다.

가져오기 과정에서는 제품 ID, 저장 제품 ID, OCR 초안 ID, 최근 검색어 중복을 제거한다. 각 항목은 최대 개수를 초과하면 앞쪽 항목부터 보존한다. 개인 기준은 저장 전 정규화해 지원하지 않는 성분 알림·식이 선호를 제거하고, 기존 알레르기 저장값 중 이관 가능한 항목은 성분 알림으로 변환한다.

## 덮어쓰기 기준

가져오기는 기존 로컬 데이터를 병합하지 않고 백업 파일의 정규화된 데이터로 대체한다. `preferences`가 `null`이면 기존 개인 기준도 제거한다.

## 보안 및 한계

- 백업 파일은 사용자의 브라우저에서 직접 생성된다.
- 파일 암호화는 제공하지 않는다.
- 파일을 다른 사람에게 전달하면 최근 스캔, 저장 제품, 검색어, OCR 초안이 노출될 수 있다.
- 이 기능은 기기 간 수동 이동을 위한 기능이며 서버 동기화 기능이 아니다.

## 관련 문서

- [데이터 신뢰도 정책](./data-trust-policy.md)
- [개인 기준 정책](./personal-preferences-policy.md)
- [저장 제품 정책](./saved-products-policy.md)
