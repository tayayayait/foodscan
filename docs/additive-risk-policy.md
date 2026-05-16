# 첨가물 위험도 정책

마지막 업데이트: 2026-05-15

식품 첨가물은 제품 점수의 30점을 구성한다. 이 문서는 첨가물 분류, 위험도 표시, 검수 큐 전송 기준을 정의한다.

## 원칙

- 첨가물은 `분류(category)`와 `위험도(riskLevel)`를 분리한다.
- 위험도는 소비자 안내와 점수 계산에 사용하되, 질병 진단이나 법적 금지 여부를 단정하지 않는다.
- 국내 기준과 해외 공식 평가가 충돌하거나 근거가 부족하면 `확실한 정보 없음`으로 표시하고 검수 대상으로 보낸다.
- 미분류 첨가물은 점수 감점에 사용하지 않는다. 검수 전까지 추정 감점을 만들지 않는다.
- E-number만 단독 표시하지 않는다. 가능한 경우 코드, 일반명, 사용 목적, 쉬운 설명을 함께 표시한다.
- 사전에 없는 전문용어는 Gemini로 쉬운 설명을 생성할 수 있지만, 이 설명은 `AI 해석`으로 표시하고 위험도·점수·검수 기준에는 반영하지 않는다.
- 위험도 확정은 `additive_risk_profiles` 시드와 `src/lib/additive-dictionary.ts`의 동일 프로필을 기준으로 한다. Gemini 또는 제품 API 응답만으로 `riskLevel`을 만들지 않는다.

## 소비자 표시 원칙

첨가물 카드는 사용자가 코드의 의미를 바로 이해할 수 있도록 다음 순서로 표시한다.

1. `E319` 같은 코드
2. `TBHQ(터셔리부틸히드로퀴논)` 같은 일반명
3. `기름 산패 방지` 같은 사용 목적
4. 제품 함량 없이는 섭취 위험을 확정할 수 없다는 근거 문구

현재 사전은 앱이 이미 분류하던 주요 E-number에 대해 일반명과 소비자용 설명을 제공한다.

| 범위/예시 | 표시 예시 | UI 사용 목적 |
| --- | --- | --- |
| `E100`-`E171` 주요 착색료 | `E102` 타르트라진, `E171` 이산화티타늄 | 색 부여 |
| `E200`-`E282` 주요 보존료 | `E211` 안식향산나트륨, `E250` 아질산나트륨 | 보존성 유지 또는 발색·보존 |
| `E300`-`E321` 주요 산화방지제 | `E319` TBHQ, `E320` BHA | 산화 방지 또는 기름 산패 방지 |
| `E270`-`E500` 주요 산도조절제 | `E330` 구연산, `E500` 탄산나트륨류 | 산도 조절 |
| `E412` 증점제·안정제 | `E412` 구아검 | 점도 조절·안정화 |
| `E551` 고결방지제 | `E551` 이산화규소 | 가루 뭉침 방지 |
| `E620`-`E635` 풍미증진제 | `E621` 글루탐산나트륨(MSG) | 감칠맛 보강 |
| `E950`-`E968` 주요 감미료 | `E951` 아스파탐, `E955` 수크랄로스 | 단맛 부여 |

사전에 없는 항목은 `explainAdditiveTerms` Edge Function action으로 Gemini에 표시용 설명을 요청한다. 이 action은 일반명, 사용 목적, 한 문장 설명만 반환하며 안전성 판정, 위험도, 점수, 금지 여부를 생성하지 않는다.

## 위험도 근거 우선순위

첨가물 위험도는 제품에 실제로 들어간 함량을 모르는 상태에서의 소비자 주의 등급이다. 따라서 법적 금지 여부와 동일하게 해석하지 않는다.

근거 우선순위는 다음 순서로 적용한다.

1. 국내 식품첨가물 기준규격, 식품안전나라 기준규격 API
2. Codex GSFA, WHO/JECFA 평가 DB
3. EFSA OpenFoodTox, EU Food Additives Database
4. FDA Substances Added to Food, Health Canada Food Additives Database
5. 보조 근거: Open Food Facts taxonomy, 검수 완료 내부 DB

`high_risk`는 공식기관의 중대한 안전성 재평가, 금지·철회·강한 제한, ADI/노출량 관리 이슈가 함께 확인되는 항목에만 부여한다.

`moderate_risk`는 허용 첨가물이지만 ADI, 민감군, 총 노출량, 재평가 이슈가 있어 주의 표시가 필요한 항목에 부여한다.

`limited_risk`는 허용 첨가물이지만 사용 목적과 섭취량 확인이 권장되는 항목에 부여한다. 구체 물질명이 없는 향료 계열 표시는 기본적으로 이 단계로 둔다.

`risk_free`는 공식 기준 내 일반 사용에서 현재 주요 위해 근거가 낮은 항목에만 부여한다.

`E412` 구아검은 Codex GSFA에서 증점제·안정제·유화제 기능군으로 등재되어 있고 JECFA ADI가 `not specified`인 항목이므로 `risk_free`로 표시한다. 제품별 함량을 알 수 없는 상태에서 별도 고위험·주의 등급을 생성하지 않는다.

`unknown`은 구체 첨가물명이 아니거나 alias/E-number/INS/CAS 매칭이 안 되는 항목에 부여한다. `혼합제제`는 단일 첨가물명이 아니므로 구성 성분 확인 전까지 `unknown`이다.

## 위험도 단계

| riskLevel | UI 문구 | severity | 첨가물 점수 처리 | 검수 |
| --- | --- | --- | ---: | --- |
| `risk_free` | 위험도 낮음 | `good` | 0점 감점 | 불필요 |
| `limited_risk` | 제한적 주의 | `normal` | 4점 감점 | 불필요 |
| `moderate_risk` | 주의 필요 | `caution` | 10점 감점 | 불필요 |
| `high_risk` | 고위험/제한 사용 | `danger` | 18점 감점, 총점 49점 상한 | 불필요 |
| `unknown` | 확실한 정보 없음 | `info` | 감점 없음 | 필요 |

## 강한 주의 대상

현재 사전은 다음 항목을 `high_risk`로 다룬다.

- `E171`, 이산화티타늄: EFSA 2021 안전성 재평가를 근거로 강한 주의 대상으로 표시한다.
- `E249`-`E252`, 아질산염/질산염: 허용량과 노출량 관리가 필요한 항목으로 표시한다. 금지 표현은 사용하지 않는다.

아질산염/질산염은 모든 사용이 위험하다고 단정하지 않는다. 공식 평가상 허용량, 식품군, 총 노출량 맥락이 필요하므로 앱 문구는 “고위험/제한 사용”과 “허용량 및 노출량 관리 대상”으로 제한한다.

## 검수 큐 기준

다음 조건이면 `unknown_additive`로 검수 큐에 보낸다.

- 사전에서 category가 `unknown`인 첨가물
- riskLevel이 `unknown`인 첨가물
- 사용자가 직접 입력했거나 OCR이 추출했지만 사전과 E-number 패턴에 매칭되지 않는 첨가물

검수 큐에는 제품 스냅샷과 `risk_flags: ["unknown_additive"]`를 포함한다.

## 구현 위치

- 사전과 위험도 메타데이터: `src/lib/additive-dictionary.ts`
- Supabase 위험도 프로필 테이블: `public.additive_risk_profiles`
- Supabase 마이그레이션/초기 시드: `supabase/migrations/20260515053717_additive_risk_profiles.sql`
- 제품 점수 반영: `src/lib/score.ts`
- 검수 큐 사유: `src/lib/review-policy.ts`
- Supabase risk flag: `src/lib/supabase-mappers.ts`
- 제품 상세 UI: `src/routes/product.$id.tsx`

## 공식 참고 자료

- [EFSA: Titanium dioxide E171 safety assessment](https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive)
- [EFSA: Nitrites and nitrates added to food](https://www.efsa.europa.eu/en/press/news/170615)
- [EFSA: Refined exposure estimates of tertiary-butyl hydroquinone (E319)](https://www.efsa.europa.eu/en/efsajournal/pub/4363)
- [EFSA: Re-evaluation of silicon dioxide (E551)](https://www.efsa.europa.eu/en/efsajournal/pub/5088)
- [식품안전나라 식품첨가물공전 품목별 사용기준 PDF](https://www.foodsafetykorea.go.kr/upload/residue/2-2-5.pdf)

## 관련 문서

- [식품 점수 정책](./food-scoring-policy.md)
- [데이터 신뢰도 정책](./data-trust-policy.md)
- [관리자 검수 흐름](./admin-review.md)
