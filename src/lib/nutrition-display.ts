import type { Nutrition } from "./types";

type NutritionKey = keyof Omit<Nutrition, "servingSize">;
type NutritionBasisKey = "per100";
type NutritionAmountUnit = "g" | "ml";

export interface NutritionAmount {
  value: number;
  unit: NutritionAmountUnit;
}

export interface NutritionBasisRow {
  key: NutritionBasisKey;
  label: string;
  amountLabel: string;
  values: Partial<Record<NutritionKey, number>>;
}

const NUTRITION_KEYS: NutritionKey[] = [
  "energyKcal",
  "sugarsG",
  "sodiumMg",
  "saturatedFatG",
  "proteinG",
];

const roundScaled = (value: number) => Math.round(value * 10) / 10;

export function parseNutritionAmount(raw?: string): NutritionAmount | null {
  if (!raw) return null;

  const normalized = raw.replace(/,/g, "").trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|㎖|l|ℓ)\b/i);
  if (!match) return null;

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  const unit = match[2].toLowerCase();
  if (unit === "kg") return { value: numericValue * 1000, unit: "g" };
  if (unit === "l" || unit === "ℓ") return { value: numericValue * 1000, unit: "ml" };
  if (unit === "㎖") return { value: numericValue, unit: "ml" };
  return { value: numericValue, unit: unit as NutritionAmountUnit };
}

function scaleNutrition(nutrition: Nutrition, multiplier: number) {
  return NUTRITION_KEYS.reduce<Partial<Record<NutritionKey, number>>>((acc, key) => {
    const value = nutrition[key];
    if (typeof value === "number") {
      acc[key] = roundScaled(value * multiplier);
    }
    return acc;
  }, {});
}

const sameAmount = (a: NutritionAmount | null, b: NutritionAmount | null) =>
  Boolean(a && b && a.unit === b.unit && Math.abs(a.value - b.value) < 0.01);

const formatAmountLabel = (amount: NutritionAmount) => {
  const value = Number.isInteger(amount.value) ? amount.value.toFixed(0) : amount.value.toFixed(1);
  return `${value} ${amount.unit}`;
};

export function buildNutritionBasisRows(nutrition: Nutrition): NutritionBasisRow[] {
  return [
    {
      key: "per100",
      label: "100g 기준",
      amountLabel: "100g/ml",
      values: scaleNutrition(nutrition, 1),
    },
  ];
}

export function formatNutritionDisplayValue(value: number | undefined, unit: string) {
  if (typeof value !== "number") return "-";
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${formatted}${unit}`;
}
