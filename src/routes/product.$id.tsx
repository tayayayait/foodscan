import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { AlternativeProducts } from "@/components/AlternativeProducts";
import { FoodPairingRecommendations } from "@/components/FoodPairingRecommendations";
import { LoadingSteps } from "@/components/LoadingSteps";
import { SourceBadge, StatusBadge } from "@/components/Badges";
import { lookupBarcode, type StageState, initialStages } from "@/lib/lookup";
import {
  getPrefs,
  getProductById,
  isProductSaved,
  pushRecent,
  toggleSavedProductRecord,
} from "@/lib/storage";
import { computeScore } from "@/lib/score";
import { buildProductVerdict } from "@/lib/product-verdict";
import { buildNutritionLevels, barRatio } from "@/lib/nutrition";
import {
  classifyAdditives,
  CATEGORY_ORDER,
  getCategoryMeta,
  getUnknownAdditives,
} from "@/lib/additive-dictionary";
import {
  applyGeminiAdditiveExplanation,
  explainAdditiveTermsWithGemini,
  type GeminiAdditiveExplanation,
} from "@/lib/additive-explanations";
import { getAlternativeRecommendations, type AlternativeRecommendation } from "@/lib/alternatives";
import { getFoodPairingRecommendations } from "@/lib/food-pairings";
import {
  buildPreferenceSummary,
  findDietaryPreferenceConflicts,
  findFoodAlertMatches,
} from "@/lib/preferences";
import { buildNutritionBasisRows, formatNutritionDisplayValue } from "@/lib/nutrition-display";
import { enqueueUnknownAdditiveReview } from "@/lib/supabase-api";
import type { FoodPairingJudgement, Product, UserPreferences } from "@/lib/types";
import { AlertTriangle, Bookmark, Share2, Info, CheckCircle2, OctagonAlert } from "lucide-react";

export const Route = createFileRoute("/product/$id")({
  validateSearch: z.object({
    view: z.enum(["history"]).optional(),
  }),
  head: ({ params }) => ({
    meta: [
      { title: `제품 정보 (${params.id}) — 식품 스캔` },
      { name: "description", content: "제품 영양·원재료·알레르기·회수 이력" },
    ],
  }),
  component: ProductPage,
});

function SeverityIcon({ sev }: { sev: string }) {
  if (sev === "good") return <CheckCircle2 size={18} style={{ color: "#16A34A" }} />;
  if (sev === "danger") return <OctagonAlert size={18} style={{ color: "#DC2626" }} />;
  if (sev === "caution") return <AlertTriangle size={18} style={{ color: "#F97316" }} />;
  return <Info size={18} style={{ color: "#64748B" }} />;
}

const SEV_BAR_COLOR: Record<string, string> = {
  good: "#16A34A",
  normal: "#EAB308",
  caution: "#F97316",
  danger: "#DC2626",
  info: "#94A3B8",
};

const VERDICT_COLOR: Record<string, string> = {
  good: "#16A34A",
  normal: "#EAB308",
  caution: "#F97316",
  danger: "#DC2626",
  info: "#64748B",
};

const VERDICT_SOFT_BG: Record<string, string> = {
  good: "#F0FDF4",
  normal: "#FEFCE8",
  caution: "#FFF7ED",
  danger: "#FEF2F2",
  info: "#F8FAFC",
};

const historySnapshotStages = (): StageState[] => [
  { key: "local", label: "저장 기록 확인", status: "ok", message: "기록 저장본" },
  { key: "public_api", label: "공공데이터 조회", status: "skipped", message: "기록 보기" },
  { key: "open_food_facts", label: "공개 DB 조회", status: "skipped", message: "기록 보기" },
  { key: "ai", label: "AI 보강", status: "skipped", message: "기록 보기" },
];

function ProductPage() {
  const { id } = Route.useParams();
  const { view } = Route.useSearch();
  const nav = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [stages, setStages] = useState<StageState[]>(initialStages());
  const [loading, setLoading] = useState(true);
  const [recallError, setRecallError] = useState(false);
  const [tab, setTab] = useState<"ingredients" | "additives" | "allergies" | "sources">(
    "ingredients",
  );
  const [alternatives, setAlternatives] = useState<AlternativeRecommendation[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const [foodPairings, setFoodPairings] = useState<FoodPairingJudgement | null>(null);
  const [foodPairingsLoading, setFoodPairingsLoading] = useState(false);
  const [foodPairingsError, setFoodPairingsError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>({
    foodAlerts: [],
    dietaryPreferences: [],
  });
  const [additiveExplanations, setAdditiveExplanations] = useState<
    Map<string, GeminiAdditiveExplanation>
  >(new Map());
  const isHistoryView = view === "history";

  useEffect(() => {
    let active = true;
    const updateStages = (nextStages: StageState[]) => {
      if (active) setStages(nextStages);
    };

    setPrefs(getPrefs());
    setRecallError(false);
    setProduct(null);
    setStages(initialStages());

    if (isHistoryView) {
      const cachedProduct = getProductById(id);
      setProduct(cachedProduct);
      setStages(historySnapshotStages());
      setSaved(cachedProduct ? isProductSaved(cachedProduct.id) : false);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    lookupBarcode(id, updateStages).then((res) => {
      if (!active) return;
      setProduct(res.product);
      setRecallError(res.recallError ?? false);
      setLoading(false);
      if (res.product) {
        pushRecent(res.product);
        setSaved(isProductSaved(res.product.id));
      } else {
        setSaved(false);
      }
    });

    return () => {
      active = false;
    };
  }, [id, isHistoryView]);

  useEffect(() => {
    let active = true;

    if (!product || isHistoryView) {
      setAlternatives([]);
      setAlternativesLoading(false);
      return;
    }

    setAlternatives([]);
    setAlternativesLoading(true);
    getAlternativeRecommendations(product, prefs)
      .then((items) => {
        if (active) setAlternatives(items);
      })
      .catch(() => {
        if (active) setAlternatives([]);
      })
      .finally(() => {
        if (active) setAlternativesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [prefs, product, isHistoryView]);

  useEffect(() => {
    let active = true;

    if (!product || isHistoryView) {
      setFoodPairings(null);
      setFoodPairingsLoading(false);
      setFoodPairingsError(false);
      return;
    }

    setFoodPairings(null);
    setFoodPairingsError(false);
    setFoodPairingsLoading(true);
    getFoodPairingRecommendations(product)
      .then((judgement) => {
        if (active) setFoodPairings(judgement);
      })
      .catch(() => {
        if (active) {
          setFoodPairings(null);
          setFoodPairingsError(true);
        }
      })
      .finally(() => {
        if (active) setFoodPairingsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product, isHistoryView]);

  useEffect(() => {
    if (isHistoryView) return;
    if (!product || product.additives.length === 0) return;

    const unknownAdditives = getUnknownAdditives(product.additives);
    if (unknownAdditives.length === 0) return;

    const storageKey = `kfs:additive-review-queued:${product.id}:${unknownAdditives.join("|")}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) return;

    let active = true;
    Promise.all(
      unknownAdditives.map((additiveName) =>
        enqueueUnknownAdditiveReview(additiveName, product.id),
      ),
    )
      .then((results) => {
        if (active && typeof window !== "undefined" && results.some(Boolean)) {
          window.sessionStorage.setItem(storageKey, "1");
        }
      })
      .catch((error) => {
        console.error("Failed to enqueue additive review", error);
      });

    return () => {
      active = false;
    };
  }, [product, isHistoryView]);

  useEffect(() => {
    let active = true;
    setAdditiveExplanations(new Map());

    if (!product || product.additives.length === 0) {
      return () => {
        active = false;
      };
    }

    explainAdditiveTermsWithGemini(product.additives).then((explanations) => {
      if (active) setAdditiveExplanations(explanations);
    });

    return () => {
      active = false;
    };
  }, [product]);

  if (loading) {
    return (
      <AppShell title="제품 정보" back={() => history.back()}>
        <div className="pt-4">
          <LoadingSteps stages={stages} />
        </div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell title="제품 정보" back={() => history.back()}>
        <div className="pt-4">
          {!isHistoryView && <LoadingSteps stages={stages} />}
          <div className="bg-surface border border-border rounded-md p-6 text-center shadow-card mt-4">
            <OctagonAlert size={28} className="mx-auto" style={{ color: "#DC2626" }} />
            <h2 className="mt-3 text-[18px] font-bold">
              {isHistoryView ? "저장된 기록 정보를 찾지 못했습니다" : "제품을 찾지 못했습니다"}
            </h2>
            <p className="mt-1 text-[14px]" style={{ color: "#64748B" }}>
              {isHistoryView
                ? "로컬 기록이 삭제되었거나 저장 형식이 변경되었습니다"
                : "사진을 추가하면 AI가 임시 제품으로 등록할 수 있습니다"}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {!isHistoryView && (
                <button
                  onClick={() => nav({ to: "/register", search: { barcode: id } })}
                  className="inline-flex items-center justify-center px-4 rounded-md font-semibold text-white"
                  style={{ height: 48, backgroundColor: "#0F766E", fontSize: 15 }}
                >
                  직접 입력으로 등록
                </button>
              )}
              <button
                onClick={() => nav({ to: "/scan", search: { mode: "barcode" } })}
                className="inline-flex items-center justify-center px-4 rounded-md font-semibold"
                style={{
                  height: 44,
                  backgroundColor: "#FFFFFF",
                  color: "#0F766E",
                  border: "1px solid #99F6E4",
                  fontSize: 15,
                }}
              >
                다시 스캔
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const score = computeScore(product, prefs);
  const verdict = buildProductVerdict(product, score);
  const foodAlertMatches = findFoodAlertMatches(product, prefs);
  const dietaryConflicts = findDietaryPreferenceConflicts(product, prefs);
  const personalPreferenceMatches = [
    ...foodAlertMatches.map((match) => match.label),
    ...dietaryConflicts.map((conflict) => conflict.label),
  ];
  const levels = buildNutritionLevels(product.nutrition);
  const nutritionBasisRows = buildNutritionBasisRows(product.nutrition);
  const scorePercent = score.computable && score.score !== null ? score.score : 0;
  const verdictColor = VERDICT_COLOR[verdict.tone] ?? VERDICT_COLOR.info;
  const preferenceSummary = buildPreferenceSummary(prefs);

  return (
    <AppShell
      title="제품 정보"
      back={() => history.back()}
      right={
        <div className="flex items-center gap-1">
          <button
            aria-label="공유"
            className="h-11 w-11 flex items-center justify-center rounded-md text-foreground hover:bg-subtle"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: product.name,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
          >
            <Share2 size={18} />
          </button>
          <button
            aria-label={saved ? "저장됨" : "저장"}
            aria-pressed={saved}
            className="h-11 w-11 flex items-center justify-center rounded-md transition-colors"
            style={{
              backgroundColor: saved ? "#CCFBF1" : "transparent",
              color: saved ? "#0F766E" : "inherit",
            }}
            onClick={() => setSaved(toggleSavedProductRecord(product))}
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      }
    >
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-6 md:pt-6">
        <div className="space-y-4 pt-4 md:pt-0">
          {/* Recall Banner */}
          {product.recall && (
            <div
              className="rounded-md p-4 border flex gap-3"
              style={{ backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }}
            >
              <AlertTriangle
                size={20}
                style={{ color: "#DC2626" }}
                className="flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="font-bold text-[15px]" style={{ color: "#991B1B" }}>
                  회수·판매중지 이력이 있습니다
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "#7F1D1D" }}>
                  {product.recall.reason} · {product.recall.company} · {product.recall.date}
                  {product.recall.grade ? ` · ${product.recall.grade}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Recall API Error Banner (§14.5) */}
          {!product.recall && recallError && (
            <div
              className="rounded-md p-4 border flex gap-3"
              style={{ backgroundColor: "#FFEDD5", borderColor: "#FDBA74" }}
            >
              <AlertTriangle
                size={20}
                style={{ color: "#9A3412" }}
                className="flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="font-bold text-[15px]" style={{ color: "#9A3412" }}>
                  회수 이력을 확인하지 못했습니다
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "#7C2D12" }}>
                  네트워크 상태를 확인한 뒤 다시 시도하세요
                </p>
              </div>
            </div>
          )}

          {/* Personal preference banner */}
          {personalPreferenceMatches.length > 0 && (
            <div
              className="rounded-md p-4 border flex gap-3"
              style={{ backgroundColor: "#FFEDD5", borderColor: "#FDBA74" }}
            >
              <AlertTriangle
                size={20}
                style={{ color: "#9A3412" }}
                className="flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="font-bold text-[15px]" style={{ color: "#9A3412" }}>
                  선택한 개인 기준에 해당하는 항목이 있습니다
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "#7C2D12" }}>
                  {personalPreferenceMatches.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Product verdict */}
          <section className="bg-surface border border-border rounded-md p-4 md:p-5 shadow-card">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_184px] md:items-center">
              <div className="flex min-w-0 gap-4">
                <div
                  className="flex-shrink-0 bg-subtle rounded-md overflow-hidden flex items-center justify-center"
                  style={{ width: 108, height: 108 }}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={`${product.name} 제품 이미지`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[12px] text-muted-foreground">이미지 없음</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <StatusBadge severity={verdict.trustSeverity}>{verdict.trustLabel}</StatusBadge>
                    <span className="inline-flex h-[24px] items-center rounded-[4px] bg-subtle px-2 text-[12px] font-semibold text-muted-foreground">
                      {verdict.confidenceLabel}
                    </span>
                  </div>
                  <h1
                    className="font-bold text-foreground"
                    style={{ fontSize: 21, lineHeight: "29px" }}
                  >
                    {product.name}
                  </h1>
                  <p
                    className="mt-1 truncate"
                    style={{ fontSize: 14, lineHeight: "22px", color: "#475569" }}
                  >
                    {product.brand || "제조사 정보 없음"}
                    {product.quantity ? ` · ${product.quantity}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.sources.map((s) => (
                      <SourceBadge key={s} source={s} />
                    ))}
                    {isHistoryView && <StatusBadge severity="info">기록 저장본</StatusBadge>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center md:justify-end">
                <div
                  className="relative flex h-[152px] w-[152px] items-center justify-center rounded-full"
                  style={{
                    background: score.computable
                      ? `conic-gradient(${verdictColor} ${Math.max(0, Math.min(100, scorePercent)) * 3.6}deg, #E5E7EB 0deg)`
                      : "#E5E7EB",
                  }}
                  aria-label={`제품 판정 ${verdict.scoreText}`}
                >
                  <div className="flex h-[122px] w-[122px] flex-col items-center justify-center rounded-full bg-white text-center">
                    <span
                      className="tabular font-extrabold"
                      style={{
                        color: verdictColor,
                        fontSize: score.computable ? 38 : 20,
                        lineHeight: score.computable ? "42px" : "26px",
                      }}
                    >
                      {verdict.scoreText}
                    </span>
                    {score.computable && (
                      <span className="text-[12px] text-muted-foreground">/100</span>
                    )}
                    <span className="mt-1 text-[12px] font-bold" style={{ color: "#334155" }}>
                      {verdict.scoreSubtext}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="mt-4 rounded-md border p-3"
              style={{
                backgroundColor: VERDICT_SOFT_BG[verdict.tone],
                borderColor: verdictColor,
              }}
            >
              <div className="flex items-start gap-2">
                <SeverityIcon sev={verdict.tone} />
                <div className="min-w-0">
                  <h2 className="text-[17px] font-bold text-foreground">판정</h2>
                  <p className="mt-1 text-[14px]" style={{ color: "#334155" }}>
                    {verdict.verdictText}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {[
                { label: "영양", value: score.breakdown.nutrition, max: 60 },
                { label: "첨가물", value: score.breakdown.additives, max: 30 },
                { label: "인증", value: score.breakdown.certification, max: 10 },
              ].map((item) => {
                const ratio =
                  item.value === null || item.max === 0
                    ? 0
                    : Math.max(0, Math.min(1, item.value / item.max));
                return (
                  <div key={item.label} className="rounded-md bg-subtle p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-foreground">{item.label}</span>
                      <span className="tabular text-[12px] font-semibold text-muted-foreground">
                        {item.value === null ? "-" : `${item.value}/${item.max}`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ratio * 100}%`,
                          backgroundColor: verdictColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <h2 className="text-[15px] font-bold text-foreground">핵심 확인 항목</h2>
              {verdict.topFindings.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {verdict.topFindings.map((finding) => (
                    <div
                      key={`${finding.title}-${finding.desc}`}
                      className="flex gap-3 rounded-md border border-border bg-white p-3"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        <SeverityIcon sev={finding.severity} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold">{finding.title}</p>
                        <p className="text-[13px]" style={{ color: "#475569" }}>
                          {finding.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-[13px] text-muted-foreground">
                  주요 주의 항목 없음
                </p>
              )}
            </div>

            {!score.computable && (
              <button
                onClick={() => nav({ to: "/register", search: { barcode: id } })}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-border-strong bg-white px-4 font-semibold text-primary"
                style={{ height: 44, fontSize: 14 }}
              >
                제품 정보 직접 보강
              </button>
            )}
          </section>

          {/* Nutrition */}
          <div className="bg-surface border border-border rounded-md p-4 shadow-card">
            <h2 className="text-[18px] font-bold mb-3">영양성분 (100g 기준)</h2>
            {nutritionBasisRows.length > 0 && (
              <div className="mb-4 divide-y divide-border rounded-md bg-subtle px-3">
                {nutritionBasisRows.map((row) => (
                  <div key={row.key} className="py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold">{row.label}</span>
                      <span className="tabular text-[12px] text-muted-foreground">
                        {row.amountLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      나트륨 {formatNutritionDisplayValue(row.values.sodiumMg, "mg")} · 당류{" "}
                      {formatNutritionDisplayValue(row.values.sugarsG, "g")} · 단백질{" "}
                      {formatNutritionDisplayValue(row.values.proteinG, "g")}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3.5">
              {levels.map((l) => {
                const ratio = barRatio(l) * 100;
                const has = l.value !== undefined;
                return (
                  <div key={l.key as string}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[14px] font-medium">{l.label}</span>
                      <span
                        className="tabular text-[13px] font-semibold"
                        style={{ color: has ? "#111827" : "#94A3B8" }}
                      >
                        {has ? `${l.value!.toFixed(1)} ${l.unit}` : "정보 없음"}{" "}
                        <span className="ml-1 text-[12px]" style={{ color: "#64748B" }}>
                          {l.levelLabel}
                        </span>
                      </span>
                    </div>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ height: 10, backgroundColor: "#F1F5F9" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${has ? ratio : 0}%`,
                          backgroundColor: SEV_BAR_COLOR[l.severity],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!isHistoryView && (
            <FoodPairingRecommendations
              judgement={foodPairings}
              loading={foodPairingsLoading}
              error={foodPairingsError}
            />
          )}

          {/* Tabs */}
          <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
            <div className="flex gap-1 p-1" style={{ backgroundColor: "#F1F5F9" }} role="tablist">
              {[
                { k: "ingredients", l: "원재료" },
                { k: "additives", l: "첨가물" },
                { k: "allergies", l: "알레르기" },
                { k: "sources", l: "출처" },
              ].map((t) => {
                const active = tab === t.k;
                return (
                  <button
                    key={t.k}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.k as typeof tab)}
                    className="flex-1 rounded-[6px] font-semibold transition-colors"
                    style={{
                      minHeight: 40,
                      minWidth: 64,
                      fontSize: 14,
                      backgroundColor: active ? "#FFFFFF" : "transparent",
                      color: active ? "#0F766E" : "#475569",
                    }}
                  >
                    {t.l}
                  </button>
                );
              })}
            </div>
            <div className="p-4">
              {tab === "ingredients" && (
                <>
                  {product.ingredients.length === 0 ? (
                    <p className="text-[14px]" style={{ color: "#64748B" }}>
                      원재료 정보가 없습니다. 사진을 추가하거나 직접 입력할 수 있습니다.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {product.ingredients.map((ing, i) => (
                        <li
                          key={i}
                          className="px-2 py-1 rounded-[4px] text-[13px]"
                          style={{
                            backgroundColor: "#F1F5F9",
                            color: i < 5 ? "#111827" : "#475569",
                            fontWeight: i < 5 ? 700 : 400,
                          }}
                        >
                          {ing}
                        </li>
                      ))}
                    </ul>
                  )}
                  {product.ingredientsText && (
                    <details className="mt-3">
                      <summary className="text-[13px] font-semibold text-primary cursor-pointer">
                        원문 보기
                      </summary>
                      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#475569" }}>
                        {product.ingredientsText}
                      </p>
                    </details>
                  )}
                </>
              )}
              {tab === "additives" && (
                <>
                  {product.additives.length === 0 ? (
                    <p className="text-[14px]" style={{ color: "#64748B" }}>
                      식별된 첨가물이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {CATEGORY_ORDER.map((cat) => {
                        const grouped = classifyAdditives(product.additives);
                        const items = grouped.get(cat);
                        if (!items || items.length === 0) return null;
                        const displayItems = items.map((item) =>
                          applyGeminiAdditiveExplanation(item, additiveExplanations),
                        );
                        const meta = getCategoryMeta(cat);
                        return (
                          <div key={cat}>
                            <p
                              className="text-[13px] font-semibold mb-1.5"
                              style={{ color: "#475569" }}
                            >
                              {meta.label}
                            </p>
                            <ul className="grid gap-2 md:grid-cols-2">
                              {displayItems.map((a, i) => (
                                <li
                                  key={i}
                                  className="rounded-md border border-border bg-white p-3"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {a.code && (
                                      <span className="inline-flex h-6 items-center rounded-[4px] bg-subtle px-2 text-[12px] font-semibold text-muted-foreground">
                                        {a.code}
                                      </span>
                                    )}
                                    <StatusBadge severity={a.severity}>{a.riskLabel}</StatusBadge>
                                    {a.explanationSource === "gemini_estimated" && (
                                      <span className="inline-flex h-6 items-center rounded-[4px] bg-subtle px-2 text-[12px] font-semibold text-muted-foreground">
                                        AI 해석
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-[15px] font-bold leading-5 text-foreground">
                                    {a.displayName}
                                  </p>
                                  <p
                                    className="mt-1 text-[12px] font-semibold leading-5"
                                    style={{ color: "#0F766E" }}
                                  >
                                    {a.purposeLabel}
                                  </p>
                                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                                    {a.consumerSummary}
                                  </p>
                                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                                    <span className="font-semibold text-foreground">근거:</span>
                                    {` ${a.riskBasis}`}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {tab === "allergies" && (
                <>
                  {foodAlertMatches.length > 0 && (
                    <div
                      className="mb-3 p-3 rounded-md"
                      style={{
                        backgroundColor: "#FEE2E2",
                        color: "#991B1B",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      성분 알림 매칭: {foodAlertMatches.map((m) => m.label).join(", ")}
                    </div>
                  )}
                  {product.allergens.length === 0 && foodAlertMatches.length === 0 ? (
                    <p className="text-[14px]" style={{ color: "#64748B" }}>
                      라벨 표기 알레르기 정보가 없습니다.
                      {prefs.foodAlerts.length === 0 &&
                        " 개인 기준에서 성분 알림을 선택하면 자동 검사합니다."}
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {product.allergens.map((a, i) => (
                        <li key={i}>
                          <StatusBadge severity="caution">{a}</StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {tab === "sources" && (
                <ul className="space-y-2 text-[14px]">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">기본 정보</span>
                    <span>
                      {product.sources.map((s, i) => (
                        <span key={s}>
                          {i > 0 && ", "}
                          <SourceBadge source={s} />
                        </span>
                      ))}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">바코드</span>
                    <span className="tabular">{product.barcode || "-"}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">신뢰도</span>
                    <span className="tabular">{(product.confidence * 100).toFixed(0)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">업데이트</span>
                    <span className="tabular text-[13px]">
                      {new Date(product.updatedAt).toLocaleString("ko-KR")}
                    </span>
                  </li>
                </ul>
              )}
            </div>
          </div>

          {!isHistoryView && (
            <AlternativeProducts recommendations={alternatives} loading={alternativesLoading} />
          )}
        </div>

        {/* Desktop side panel */}
        <aside className="hidden md:block space-y-4">
          <div className="bg-surface border border-border rounded-md p-4 shadow-card">
            <h3 className="text-[15px] font-bold mb-2">출처 요약</h3>
            <div className="flex flex-wrap gap-1.5">
              {product.sources.map((s) => (
                <SourceBadge key={s} source={s} />
              ))}
            </div>
            <p className="mt-3 text-[12px]" style={{ color: "#64748B" }}>
              마지막 업데이트: {new Date(product.updatedAt).toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-md p-4 shadow-card">
            <h3 className="text-[15px] font-bold mb-2">개인 기준</h3>
            <p className="text-[13px] text-muted-foreground">
              현재 적용: {preferenceSummary.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preferenceSummary.badges.length === 0 ? (
                <span className="rounded-[4px] bg-subtle px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                  추가 기준 없음
                </span>
              ) : (
                preferenceSummary.badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-[4px] bg-subtle px-2 py-1 text-[12px] font-semibold text-muted-foreground"
                  >
                    {badge}
                  </span>
                ))
              )}
            </div>
            <Link
              to="/preferences"
              className="inline-block mt-3 text-[13px] font-semibold text-primary"
            >
              개인 기준 설정 →
            </Link>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
