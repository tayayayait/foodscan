import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import {
  buildHistoryInsights,
  filterAttentionProducts,
  type AttentionProduct,
} from "@/lib/history-insights";
import { buildSafetyWatch, type SafetyWatchItem, type SafetyWatchResult } from "@/lib/safety-watch";
import { getPrefs, getProvisional, getRecent, getSavedProducts } from "@/lib/storage";
import type { Grade, Product, Severity, UserPreferences } from "@/lib/types";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bookmark,
  ChevronRight,
  Info,
  ListFilter,
  OctagonAlert,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "기록 — 식품 스캔" },
      { name: "description", content: "최근 스캔한 제품 목록" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [list, setList] = useState<Product[]>([]);
  const [savedList, setSavedList] = useState<Product[]>([]);
  const [provisionalList, setProvisionalList] = useState<Product[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences>({
    foodAlerts: [],
    dietaryPreferences: [],
  });
  const [mode, setMode] = useState<"all" | "attention" | "saved">("all");

  useEffect(() => {
    setList(getRecent());
    setSavedList(getSavedProducts());
    setProvisionalList(getProvisional());
    setPrefs(getPrefs());
  }, []);

  const insights = buildHistoryInsights(list, prefs);
  const attentionProducts = filterAttentionProducts(list, prefs);
  const safetyWatch = buildSafetyWatch({
    recent: list,
    saved: savedList,
    provisional: provisionalList,
    prefs,
  });
  const visibleAll = mode === "all";
  const visibleAttention = mode === "attention";
  const visibleSaved = mode === "saved";
  const visibleList = visibleSaved
    ? savedList
    : visibleAttention
      ? attentionProducts.map((item) => item.product)
      : list;
  const hasAnyProducts = list.length > 0 || savedList.length > 0;

  return (
    <AppShell title="기록">
      <div className="pt-4">
        {!hasAnyProducts ? (
          <div className="bg-surface border border-border rounded-md p-6 text-center shadow-card">
            <h3 className="text-[16px] font-bold">기록이 없습니다</h3>
            <p className="mt-1 text-[14px]" style={{ color: "#64748B" }}>
              스캔한 제품이 여기에 자동 저장됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <HistoryInsightPanel insights={insights} attentionCount={attentionProducts.length} />
            <SafetyWatchPanel watch={safetyWatch} />

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold">스캔 제품</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {visibleSaved
                    ? "저장한 제품만 표시"
                    : visibleAttention
                      ? "확인이 필요한 제품만 표시"
                      : "최근 스캔 순서"}
                </p>
              </div>
              <div className="flex rounded-md bg-subtle p-1" role="tablist" aria-label="기록 필터">
                <button
                  role="tab"
                  aria-selected={visibleAll}
                  onClick={() => setMode("all")}
                  className="h-9 rounded-[6px] px-3 text-[13px] font-semibold"
                  style={{
                    backgroundColor: visibleAll ? "#FFFFFF" : "transparent",
                    color: visibleAll ? "#0F766E" : "#475569",
                  }}
                >
                  전체
                </button>
                <button
                  role="tab"
                  aria-selected={visibleAttention}
                  onClick={() => setMode("attention")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-semibold"
                  style={{
                    backgroundColor: visibleAttention ? "#FFFFFF" : "transparent",
                    color: visibleAttention ? "#0F766E" : "#475569",
                  }}
                >
                  <ListFilter size={14} />
                  주의 {attentionProducts.length}
                </button>
                <button
                  role="tab"
                  aria-selected={visibleSaved}
                  onClick={() => setMode("saved")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-semibold"
                  style={{
                    backgroundColor: visibleSaved ? "#FFFFFF" : "transparent",
                    color: visibleSaved ? "#0F766E" : "#475569",
                  }}
                >
                  <Bookmark size={14} fill={visibleSaved ? "currentColor" : "none"} />
                  저장 {savedList.length}
                </button>
              </div>
            </div>

            {visibleList.length === 0 ? (
              <div className="rounded-md border border-border bg-surface p-5 text-center shadow-card">
                <p className="text-[15px] font-bold">
                  {visibleSaved ? "저장한 제품이 없습니다" : "확인이 필요한 제품이 없습니다"}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {visibleSaved
                    ? "제품 상세에서 북마크 버튼을 누르면 여기에 보관됩니다"
                    : "현재 기록에서는 회수, 검수 필요, 개인 기준 경고가 감지되지 않았습니다"}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visibleAttention
                  ? attentionProducts.map((item) => (
                      <AttentionProductRow key={item.product.id} item={item} />
                    ))
                  : visibleList.map((p) => (
                      <li key={p.id}>
                        <ProductCard product={p} linkView="history" />
                      </li>
                    ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const watchTone: Record<Severity, { bg: string; border: string; fg: string; Icon: typeof Info }> = {
  danger: { bg: "#FEF2F2", border: "#FCA5A5", fg: "#991B1B", Icon: OctagonAlert },
  caution: { bg: "#FFF7ED", border: "#FDBA74", fg: "#9A3412", Icon: AlertTriangle },
  normal: { bg: "#FEFCE8", border: "#FDE68A", fg: "#854D0E", Icon: AlertTriangle },
  info: { bg: "#F8FAFC", border: "#CBD5E1", fg: "#334155", Icon: Info },
  good: { bg: "#F0FDF4", border: "#BBF7D0", fg: "#166534", Icon: Info },
};

function SafetyWatchPanel({ watch }: { watch: SafetyWatchResult }) {
  const flagged = watch.summary.flaggedCount;
  const tone = flagged > 0 ? watchTone[watch.items[0].severity] : watchTone.good;
  const Icon = tone.Icon;

  return (
    <section
      className="rounded-md border p-4 shadow-card"
      aria-label="안전 감시"
      style={{ backgroundColor: tone.bg, borderColor: tone.border }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: "#FFFFFF", color: tone.fg }}
        >
          <Bell size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[16px] font-bold" style={{ color: tone.fg }}>
              안전 감시
            </h2>
            <span
              className="rounded-[6px] bg-white px-2 py-1 text-[12px] font-bold"
              style={{ color: tone.fg }}
            >
              {flagged > 0 ? `${flagged}개 알림` : "알림 없음"}
            </span>
          </div>
          <p className="mt-1 text-[13px]" style={{ color: tone.fg }}>
            {flagged > 0
              ? "저장·최근·임시 제품에서 즉시 확인할 위험을 우선 정렬했습니다."
              : "저장·최근·임시 제품에서 즉시 확인할 위험이 없습니다."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <WatchMetric label="회수" value={watch.summary.recallCount} />
        <WatchMetric label="긴급" value={watch.summary.dangerCount} />
        <WatchMetric label="주의" value={watch.summary.cautionCount} />
        <WatchMetric label="저장 포함" value={watch.summary.savedFlaggedCount} />
      </div>

      {flagged > 0 ? (
        <ul className="mt-4 space-y-2">
          {watch.items.slice(0, 3).map((item) => (
            <SafetyWatchRow key={`${item.product.id}-${item.reasons[0].key}`} item={item} />
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-white px-3 py-2">
          <Icon size={16} style={{ color: tone.fg }} />
          <p className="text-[13px] font-semibold" style={{ color: tone.fg }}>
            총 {watch.summary.totalWatched}개 제품 감시 중
          </p>
        </div>
      )}
    </section>
  );
}

function WatchMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tabular text-foreground">{value}</p>
    </div>
  );
}

function SafetyWatchRow({ item }: { item: SafetyWatchItem }) {
  const tone = watchTone[item.severity];
  const Icon = tone.Icon;

  return (
    <li>
      <Link
        to="/product/$id"
        params={{ id: item.product.id }}
        search={{ view: "history" }}
        className="block rounded-md bg-white p-3 transition-colors hover:bg-[#F8FAFC]"
      >
        <div className="flex gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px]"
            style={{ backgroundColor: tone.bg, color: tone.fg }}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-foreground">
                  {item.product.name}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {item.sourceLabels.join(" · ")} · {item.action}
                </p>
              </div>
              <ChevronRight size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.reasons.slice(0, 3).map((reason) => (
                <span
                  key={`${item.product.id}-${reason.key}`}
                  className="rounded-[6px] px-2 py-1 text-[12px] font-bold"
                  style={{
                    backgroundColor: watchTone[reason.severity].bg,
                    color: watchTone[reason.severity].fg,
                  }}
                >
                  {reason.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

const gradeColors: Record<Grade, string> = {
  A: "#16A34A",
  B: "#65A30D",
  C: "#EAB308",
  D: "#F97316",
  E: "#DC2626",
};

function HistoryInsightPanel({
  insights,
  attentionCount,
}: {
  insights: ReturnType<typeof buildHistoryInsights>;
  attentionCount: number;
}) {
  const grades: Grade[] = ["A", "B", "C", "D", "E"];
  const topTone =
    insights.topConcern?.severity === "danger"
      ? { bg: "#FEF2F2", border: "#FCA5A5", fg: "#991B1B", Icon: ShieldAlert }
      : { bg: "#FFF7ED", border: "#FDBA74", fg: "#9A3412", Icon: AlertTriangle };
  const TopIcon = topTone.Icon;

  return (
    <section className="space-y-3" aria-label="기록 인사이트">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricCard
          label="평균 점수"
          value={insights.averageScore === null ? "-" : String(insights.averageScore)}
          helper={`점수 가능 ${insights.scoredCount}/${insights.totalCount}`}
        />
        <MetricCard label="주의 제품" value={String(attentionCount)} helper="후속 확인 대상" />
        <MetricCard
          label="검수 필요"
          value={String(insights.reviewNeededCount)}
          helper="확정 전 데이터"
        />
        <MetricCard
          label="최다 요인"
          value={insights.topConcern?.label ?? "없음"}
          helper={insights.topConcern ? `${insights.topConcern.count}개 제품` : "감지 안 됨"}
        />
      </div>

      {insights.topConcern && (
        <div
          className="rounded-md border p-4"
          style={{
            backgroundColor: topTone.bg,
            borderColor: topTone.border,
            color: topTone.fg,
          }}
        >
          <div className="flex gap-2">
            <TopIcon size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[14px] font-bold">
                {insights.topConcern.label} · {insights.topConcern.count}개 제품
              </p>
              <p className="mt-1 text-[13px]">{insights.topConcern.action}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 size={17} style={{ color: "#0F766E" }} />
          <h2 className="text-[15px] font-bold">등급 분포</h2>
        </div>
        <div className="space-y-2">
          {grades.map((grade) => {
            const count = insights.gradeCounts[grade];
            const width =
              insights.scoredCount > 0 ? `${(count / insights.scoredCount) * 100}%` : "0%";
            return (
              <div key={grade} className="grid grid-cols-[24px_1fr_28px] items-center gap-2">
                <span className="text-[13px] font-bold">{grade}</span>
                <div className="h-2 overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full"
                    style={{ width, backgroundColor: gradeColors[grade] }}
                  />
                </div>
                <span className="text-right text-[12px] font-semibold text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-card">
      <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[22px] font-bold tracking-normal">{value}</p>
      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function AttentionProductRow({ item }: { item: AttentionProduct }) {
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {item.reasons.map((reason) => (
          <span
            key={reason}
            className="rounded-[6px] px-2 py-1 text-[12px] font-bold"
            style={{ backgroundColor: "#FFEDD5", color: "#9A3412" }}
          >
            {reason}
          </span>
        ))}
      </div>
      <ProductCard product={item.product} linkView="history" />
    </li>
  );
}
