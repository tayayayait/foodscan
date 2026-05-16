create table if not exists public.additive_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  aliases text[] not null default '{}',
  e_number text,
  ins_number text,
  cas_number text,
  category text not null
    check (category in (
      'sweetener',
      'preservative',
      'antioxidant',
      'colorant',
      'acidity_regulator',
      'stabilizer',
      'anticaking_agent',
      'flavor',
      'unknown'
    )),
  purpose_label text not null,
  consumer_summary text not null,
  risk_level text not null
    check (risk_level in ('risk_free', 'limited_risk', 'moderate_risk', 'high_risk', 'unknown')),
  score_penalty integer not null check (score_penalty >= 0),
  score_cap integer check (score_cap >= 0 and score_cap <= 100),
  review_required boolean not null default false,
  basis_ko text not null,
  source_urls text[] not null default '{}',
  evidence_level text not null
    check (evidence_level in (
      'official_restriction',
      'regulatory_condition',
      'safety_evaluated',
      'unmatched'
    )),
  reviewed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists additive_risk_profiles_e_number_idx
on public.additive_risk_profiles (e_number)
where e_number is not null;

create index if not exists additive_risk_profiles_ins_number_idx
on public.additive_risk_profiles (ins_number)
where ins_number is not null;

create index if not exists additive_risk_profiles_aliases_idx
on public.additive_risk_profiles using gin (aliases);

drop trigger if exists additive_risk_profiles_set_updated_at on public.additive_risk_profiles;
create trigger additive_risk_profiles_set_updated_at
before update on public.additive_risk_profiles
for each row execute function public.set_updated_at();

alter table public.additive_risk_profiles enable row level security;

drop policy if exists "public_read_additive_risk_profiles" on public.additive_risk_profiles;
create policy "public_read_additive_risk_profiles"
on public.additive_risk_profiles for select
to anon, authenticated
using (true);

insert into public.additive_risk_profiles (
  canonical_name,
  aliases,
  e_number,
  ins_number,
  category,
  purpose_label,
  consumer_summary,
  risk_level,
  score_penalty,
  score_cap,
  review_required,
  basis_ko,
  source_urls,
  evidence_level
) values
(
  '이산화티타늄',
  array['E171', 'TITANIUMDIOXIDE', 'TITANIUM DIOXIDE'],
  'E171',
  'INS171',
  'colorant',
  '색 부여',
  '흰색을 내는 착색료입니다. EFSA 2021 안전성 재평가에서 식품첨가물로 안전하다고 볼 수 없다는 결론이 제시되어 강한 주의 대상으로 분류합니다.',
  'high_risk',
  18,
  49,
  false,
  'EFSA 2021 E171 안전성 재평가에서 식품첨가물 사용 안전성에 중대한 이슈가 제기됨',
  array[
    'https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive',
    'https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'official_restriction'
),
(
  '아질산나트륨',
  array['E250', 'SODIUMNITRITE', 'SODIUM NITRITE'],
  'E250',
  'INS250',
  'preservative',
  '발색·보존',
  '주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.',
  'high_risk',
  18,
  49,
  false,
  '아질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'regulatory_condition'
),
(
  '아질산칼륨',
  array['E249', 'POTASSIUMNITRITE', 'POTASSIUM NITRITE'],
  'E249',
  'INS249',
  'preservative',
  '발색·보존',
  '주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.',
  'high_risk',
  18,
  49,
  false,
  '아질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'regulatory_condition'
),
(
  '질산나트륨',
  array['E251', 'SODIUMNITRATE', 'SODIUM NITRATE'],
  'E251',
  'INS251',
  'preservative',
  '발색·보존',
  '주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.',
  'high_risk',
  18,
  49,
  false,
  '질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'regulatory_condition'
),
(
  '질산칼륨',
  array['E252', 'POTASSIUMNITRATE', 'POTASSIUM NITRATE'],
  'E252',
  'INS252',
  'preservative',
  '발색·보존',
  '주로 육가공품의 색과 보존성을 유지하는 보존료입니다. 허용량과 총 노출량 관리가 필요한 항목이라 고위험 주의 대상으로 분류합니다.',
  'high_risk',
  18,
  49,
  false,
  '질산염류는 허용량과 총 노출량 관리가 필요한 보존·발색 첨가물',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'regulatory_condition'
),
(
  '아스파탐',
  array['E951', 'ASPARTAME'],
  'E951',
  'INS951',
  'sweetener',
  '단맛 부여',
  '저칼로리 감미료입니다. ADI와 섭취량 관리 기준이 있어 주의 필요 항목으로 분류합니다.',
  'moderate_risk',
  10,
  null,
  false,
  'ADI와 섭취량 기준이 있는 감미료이며 민감군·총 섭취량 확인이 필요함',
  array[
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox',
    'https://www.fao.org/gsfaonline/'
  ],
  'regulatory_condition'
),
(
  '수크랄로스',
  array['E955', 'SUCRALOSE'],
  'E955',
  'INS955',
  'sweetener',
  '단맛 부여',
  '고감미 감미료입니다. ADI와 섭취량 관리 기준이 있어 주의 필요 항목으로 분류합니다.',
  'moderate_risk',
  10,
  null,
  false,
  'ADI와 섭취량 기준이 있는 감미료이며 총 섭취량 확인이 필요함',
  array[
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://www.efsa.europa.eu/en/data-report/chemical-hazards-database-openfoodtox',
    'https://www.fao.org/gsfaonline/'
  ],
  'regulatory_condition'
),
(
  '타르트라진',
  array['E102', 'TARTRAZINE', '식용색소황색4호'],
  'E102',
  'INS102',
  'colorant',
  '색 부여',
  '노란색을 내는 착색료입니다. 착색료 계열 주의 대상으로 분류하며 민감군은 표시 정보를 확인해야 합니다.',
  'moderate_risk',
  10,
  null,
  false,
  '착색료 계열로 사용 조건과 민감군 주의가 필요한 항목',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'regulatory_condition'
),
(
  '안식향산나트륨',
  array['E211', 'SODIUMBENZOATE', 'SODIUM BENZOATE', '안식향산'],
  'E211',
  'INS211',
  'preservative',
  '보존성 유지',
  '미생물 증식을 늦추는 보존료입니다. 사용 기준과 총 섭취량 확인이 필요한 항목으로 분류합니다.',
  'moderate_risk',
  10,
  null,
  false,
  '보존료 계열로 사용 조건과 총 노출량 확인이 필요한 항목',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'regulatory_condition'
),
(
  '합성착향료',
  array[
    '합성향료',
    '착향료',
    'ARTIFICIALFLAVOR',
    'ARTIFICIAL FLAVOR',
    'SYNTHETICFLAVOR',
    'SYNTHETIC FLAVOR',
    'FLAVOURING',
    'FLAVORING'
  ],
  null,
  null,
  'flavor',
  '향미 보강',
  '향미를 보강하는 향료 계열 표시입니다. 구체 물질과 함량이 없으면 독성 등급을 확정할 수 없어 제한적 주의로 표시합니다.',
  'limited_risk',
  4,
  null,
  false,
  '향료 계열은 구체 물질과 함량 확인 전까지 제한적 주의로 처리',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://www.fda.gov/food/food-additives-petitions/substances-added-food-formerly-eafus'
  ],
  'regulatory_condition'
),
(
  '글루탐산나트륨(MSG)',
  array['E621', 'MSG', 'MONOSODIUMGLUTAMATE', 'MONOSODIUM GLUTAMATE', '글루탐산나트륨'],
  'E621',
  'INS621',
  'flavor',
  '감칠맛 보강',
  '감칠맛을 보강하는 풍미증진제입니다. 일반적 사용 기준 내에서는 허용되지만 섭취량 확인이 필요한 제한적 주의 항목입니다.',
  'limited_risk',
  4,
  null,
  false,
  '풍미증진제 계열로 사용 목적과 섭취량 확인이 권장됨',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://health-infobase.canada.ca/nutrition/food-additives/'
  ],
  'safety_evaluated'
),
(
  '구연산',
  array['E330', 'CITRICACID', 'CITRIC ACID'],
  'E330',
  'INS330',
  'acidity_regulator',
  '산도 조절',
  '맛과 산도를 조절하거나 제조 공정을 안정화하는 산도조절제입니다.',
  'risk_free',
  0,
  null,
  false,
  '공식 기준 내 일반 사용에서 주요 위해 근거가 낮은 산도조절제',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'safety_evaluated'
),
(
  '구아검',
  array['E412', 'GUARGUM', 'GUAR GUM', 'GUARFLOUR', 'GUAR FLOUR', 'GUMCYAMOPSIS', 'GUM CYAMOPSIS'],
  'E412',
  'INS412',
  'stabilizer',
  '점도 조절·안정화',
  '식품의 점도를 높이고 재료가 분리되지 않도록 돕는 증점제·안정제입니다.',
  'risk_free',
  0,
  null,
  false,
  'Codex GSFA는 구아검(INS 412)을 증점제·안정제·유화제로 등재하고 JECFA는 ADI를 not specified로 평가함',
  array[
    'https://www.fao.org/gsfaonline/additives/details.html?id=9',
    'https://inchem.org/documents/jecfa/jeceval/jec_946.htm'
  ],
  'safety_evaluated'
),
(
  '이산화규소',
  array['E551', 'SILICONDIOXIDE', 'SILICON DIOXIDE', 'SILICA'],
  'E551',
  'INS551',
  'anticaking_agent',
  '가루 뭉침 방지',
  '분말 조미료나 가루 원료가 서로 뭉치지 않게 하는 고결방지제입니다.',
  'risk_free',
  0,
  null,
  false,
  '식품첨가물공전 사용기준상 고결방지제·거품제거제·여과보조제 목적 사용',
  array[
    'https://www.fao.org/gsfaonline/',
    'https://apps.who.int/food-additives-contaminants-jecfa-database/',
    'https://food.ec.europa.eu/food-safety/food-improvement-agents/additives/database_en'
  ],
  'safety_evaluated'
),
(
  '혼합제제',
  array['MIXEDPREPARATION', 'MIXED PREPARATION', '혼합제제류'],
  null,
  null,
  'unknown',
  '분류 정보 없음',
  '여러 첨가물을 섞은 제제 표시로, 단일 구체 첨가물명이 아닙니다. 구성 성분 원문이 필요합니다.',
  'unknown',
  0,
  null,
  true,
  '구체 첨가물명이 아닙니다. 혼합제제의 구성 성분이 확인되기 전까지 위험도를 확정하지 않습니다.',
  array['https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/'],
  'unmatched'
)
on conflict (canonical_name) do update set
  aliases = excluded.aliases,
  e_number = excluded.e_number,
  ins_number = excluded.ins_number,
  cas_number = excluded.cas_number,
  category = excluded.category,
  purpose_label = excluded.purpose_label,
  consumer_summary = excluded.consumer_summary,
  risk_level = excluded.risk_level,
  score_penalty = excluded.score_penalty,
  score_cap = excluded.score_cap,
  review_required = excluded.review_required,
  basis_ko = excluded.basis_ko,
  source_urls = excluded.source_urls,
  evidence_level = excluded.evidence_level,
  reviewed_at = current_date;
