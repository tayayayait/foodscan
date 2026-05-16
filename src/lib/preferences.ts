import type { DietaryPreference, FoodAlertPreference, Product, UserPreferences } from "./types";

export const FOOD_ALERT_OPTIONS: {
  key: FoodAlertPreference;
  label: string;
  desc: string;
}[] = [
  { key: "gluten", label: "글루텐", desc: "밀·글루텐 포함 시 알림" },
  { key: "lactose", label: "유당", desc: "우유·유당 성분 포함 시 알림" },
  { key: "sulfites", label: "아황산류", desc: "아황산류 포함 시 알림" },
  { key: "soy", label: "대두", desc: "대두 성분 포함 시 알림" },
  { key: "palm_oil", label: "팜유", desc: "팜유 포함 시 알림" },
];

export const DIETARY_PREFERENCE_OPTIONS: {
  key: DietaryPreference;
  label: string;
  desc: string;
}[] = [
  { key: "vegetarian", label: "채식", desc: "육류·해산물 성분이 있으면 알림" },
  { key: "vegan", label: "비건", desc: "동물성 성분이 있으면 알림" },
  { key: "pork_free", label: "돼지고기 제외", desc: "돼지고기 성분이 있으면 알림" },
];

export interface FoodAlertMatch {
  key: FoodAlertPreference;
  label: string;
  matchType: "direct" | "estimated";
}

export interface DietaryPreferenceConflict {
  key: DietaryPreference;
  label: string;
}

const VALID_FOOD_ALERTS = new Set(FOOD_ALERT_OPTIONS.map((option) => option.key));
const VALID_DIETARY_PREFERENCES = new Set(DIETARY_PREFERENCE_OPTIONS.map((option) => option.key));

const FOOD_ALERT_PATTERNS: Record<
  FoodAlertPreference,
  { aliases: string[]; directAllergens: string[] }
> = {
  gluten: {
    aliases: ["gluten", "글루텐", "wheat", "밀"],
    directAllergens: ["gluten", "글루텐", "wheat", "밀"],
  },
  lactose: {
    aliases: ["lactose", "유당", "milk", "우유", "원유", "분유"],
    directAllergens: ["lactose", "유당", "milk", "우유"],
  },
  sulfites: {
    aliases: ["sulfite", "sulphite", "아황산"],
    directAllergens: ["sulfite", "sulphite", "아황산류"],
  },
  soy: {
    aliases: ["soy", "대두"],
    directAllergens: ["soy", "대두"],
  },
  palm_oil: {
    aliases: ["palm oil", "팜유", "팜올레인"],
    directAllergens: [],
  },
};

const VEGETARIAN_CONFLICT_PATTERNS = [
  "beef",
  "pork",
  "chicken",
  "fish",
  "shrimp",
  "crab",
  "squid",
  "shellfish",
  "gelatin",
  "쇠고기",
  "소고기",
  "돼지고기",
  "돈육",
  "닭고기",
  "고등어",
  "게",
  "새우",
  "오징어",
  "조개",
  "젤라틴",
];

const VEGAN_CONFLICT_PATTERNS = [
  ...VEGETARIAN_CONFLICT_PATTERNS,
  "milk",
  "lactose",
  "egg",
  "honey",
  "우유",
  "원유",
  "분유",
  "유당",
  "계란",
  "난백",
  "난황",
  "꿀",
];

const PORK_FREE_CONFLICT_PATTERNS = ["pork", "lard", "돼지고기", "돈육", "돈지"];

const DIETARY_CONFLICT_PATTERNS: Record<DietaryPreference, string[]> = {
  vegetarian: VEGETARIAN_CONFLICT_PATTERNS,
  vegan: VEGAN_CONFLICT_PATTERNS,
  pork_free: PORK_FREE_CONFLICT_PATTERNS,
};

const LEGACY_ALERT_MAP: Record<string, FoodAlertPreference> = {
  밀: "gluten",
  우유: "lactose",
  대두: "soy",
  아황산류: "sulfites",
};

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string" && value.trim())
        .map((value) => value.trim()),
    ),
  ];
}

function optionLabel<T extends string>(options: Array<{ key: T; label: string }>, key: T): string {
  return options.find((option) => option.key === key)?.label ?? key;
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase();
}

const TRACE_NOTICE_PATTERNS = [
  "may contain traces of",
  "may contain trace",
  "manufactured in a facility",
  "same facility",
  "같은 제조시설",
  "혼입 가능",
];

function stripTraceNotices(value: string | undefined) {
  if (!value) return "";
  return value
    .split(/(?<=[.!?。])\s+|\r?\n/u)
    .filter((segment) => {
      const normalized = normalizeText(segment);
      return !TRACE_NOTICE_PATTERNS.some((pattern) => normalized.includes(pattern));
    })
    .join(" ");
}

function corpusFor(product: Product) {
  return normalizeText(
    [stripTraceNotices(product.ingredientsText), ...product.ingredients, ...product.allergens].join(
      " ",
    ),
  );
}

function includesPattern(value: string, pattern: string) {
  return value.includes(normalizeText(pattern));
}

function selectedLegacyAlerts(record: Record<string, unknown>) {
  return uniqueStrings(record.allergens)
    .map((allergen) => LEGACY_ALERT_MAP[allergen])
    .filter((alert): alert is FoodAlertPreference => Boolean(alert));
}

export function normalizePreferences(value: unknown): UserPreferences {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const foodAlerts = [
    ...new Set([
      ...uniqueStrings(record.foodAlerts).filter((alert): alert is FoodAlertPreference =>
        VALID_FOOD_ALERTS.has(alert as FoodAlertPreference),
      ),
      ...selectedLegacyAlerts(record),
    ]),
  ];

  const dietaryPreferences = uniqueStrings(record.dietaryPreferences).filter(
    (preference): preference is DietaryPreference =>
      VALID_DIETARY_PREFERENCES.has(preference as DietaryPreference),
  );

  return {
    foodAlerts,
    dietaryPreferences,
  };
}

export function findFoodAlertMatches(product: Product, prefs: UserPreferences): FoodAlertMatch[] {
  const corpus = corpusFor(product);
  const labeledAllergens = product.allergens.map((allergen) => normalizeText(allergen));

  return prefs.foodAlerts.flatMap((key) => {
    const matcher = FOOD_ALERT_PATTERNS[key];
    const direct = matcher.directAllergens.some((pattern) =>
      labeledAllergens.some((allergen) => includesPattern(allergen, pattern)),
    );
    const estimated = matcher.aliases.some((pattern) => includesPattern(corpus, pattern));
    if (!direct && !estimated) return [];
    return [
      {
        key,
        label: optionLabel(FOOD_ALERT_OPTIONS, key),
        matchType: direct ? "direct" : "estimated",
      },
    ];
  });
}

export function findDietaryPreferenceConflicts(
  product: Product,
  prefs: UserPreferences,
): DietaryPreferenceConflict[] {
  const corpus = corpusFor(product);

  return prefs.dietaryPreferences.flatMap((key) => {
    const hasConflict = DIETARY_CONFLICT_PATTERNS[key].some((pattern) =>
      includesPattern(corpus, pattern),
    );
    if (!hasConflict) return [];
    return [
      {
        key,
        label: optionLabel(DIETARY_PREFERENCE_OPTIONS, key),
      },
    ];
  });
}

export function isProductCompatibleWithPreferences(product: Product, prefs: UserPreferences) {
  return (
    findFoodAlertMatches(product, prefs).length === 0 &&
    findDietaryPreferenceConflicts(product, prefs).length === 0
  );
}

export function buildPreferenceSummary(prefs: UserPreferences) {
  const selectedLabels = [
    ...prefs.foodAlerts.map((key) => optionLabel(FOOD_ALERT_OPTIONS, key)),
    ...prefs.dietaryPreferences.map((key) => optionLabel(DIETARY_PREFERENCE_OPTIONS, key)),
  ];

  const badges: string[] = [];
  if (prefs.foodAlerts.length > 0) badges.push(`성분 알림 ${prefs.foodAlerts.length}개`);
  if (prefs.dietaryPreferences.length > 0) {
    badges.push(`식이 선호 ${prefs.dietaryPreferences.length}개`);
  }

  return {
    description: selectedLabels.length > 0 ? selectedLabels.join(", ") : "선택한 기준 없음",
    badges,
  };
}
