import type { Nutrition, Severity } from "./types";

export interface NutritionLevel {
  key: keyof Nutrition;
  label: string;
  unit: string;
  value: number | undefined;
  severity: Severity;
  levelLabel: string;
}

function classify(
  v: number | undefined,
  low: number,
  high: number,
): { severity: Severity; label: string } {
  if (v === undefined) return { severity: "info", label: "정보 없음" };
  if (v <= low) return { severity: "good", label: "낮음" };
  if (v <= high) return { severity: "normal", label: "보통" };
  return { severity: "danger", label: "높음" };
}

function classifyProtein(v: number | undefined): {
  severity: Severity;
  label: string;
} {
  if (v === undefined) return { severity: "info", label: "정보 없음" };
  if (v < 5) return { severity: "caution", label: "낮음" };
  if (v < 10) return { severity: "normal", label: "보통" };
  return { severity: "good", label: "높음" };
}

export function buildNutritionLevels(n: Nutrition): NutritionLevel[] {
  const e = classify(n.energyKcal, 100, 250);
  const s = classify(n.sugarsG, 5, 15);
  const so = classify(n.sodiumMg, 500, 1000);
  const sf = classify(n.saturatedFatG, 3, 7);
  const p = classifyProtein(n.proteinG);
  return [
    {
      key: "energyKcal",
      label: "열량",
      unit: "kcal",
      value: n.energyKcal,
      severity: e.severity,
      levelLabel: e.label,
    },
    {
      key: "sugarsG",
      label: "당류",
      unit: "g",
      value: n.sugarsG,
      severity: s.severity,
      levelLabel: s.label,
    },
    {
      key: "sodiumMg",
      label: "나트륨",
      unit: "mg",
      value: n.sodiumMg,
      severity: so.severity,
      levelLabel: so.label,
    },
    {
      key: "saturatedFatG",
      label: "포화지방",
      unit: "g",
      value: n.saturatedFatG,
      severity: sf.severity,
      levelLabel: sf.label,
    },
    {
      key: "proteinG",
      label: "단백질",
      unit: "g",
      value: n.proteinG,
      severity: p.severity,
      levelLabel: p.label,
    },
  ];
}

// fill ratio 0..1 for bar width based on rough max
export function barRatio(level: NutritionLevel): number {
  if (level.value === undefined) return 0;
  const maxes: Record<string, number> = {
    energyKcal: 500,
    sugarsG: 30,
    sodiumMg: 1500,
    saturatedFatG: 15,
    proteinG: 25,
  };
  const max = maxes[level.key as string] || 100;
  return Math.min(1, level.value / max);
}
