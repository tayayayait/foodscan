import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badges";
import {
  approveReviewItem,
  listReviewQueue,
  updateReviewStatus,
  verifyAdminAccess,
} from "@/lib/supabase-api";
import {
  DEFAULT_REVIEW_QUEUE_FILTERS,
  applyReviewProductDraft,
  filterAndSortReviewQueueItems,
  reviewApprovalCheck,
  reviewProductDraftFromProduct,
  reviewQueuePriorityOf,
  type ReviewProductDraft,
  type ReviewQueueFilters,
  type ReviewQueueItem,
  type ReviewQueueListStatus,
} from "@/lib/review-queue";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "관리자 검수 - 식품 스캔" },
      { name: "description", content: "미검수 제품을 필터링하고 수정, 승인, 반려합니다." },
    ],
  }),
  component: AdminPage,
});

const STATUS_FILTERS: { key: ReviewQueueListStatus; label: string }[] = [
  { key: "pending", label: "미검수" },
  { key: "in_review", label: "검수 중" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "반려" },
  { key: "all", label: "전체" },
];

const SOURCE_FILTERS: { key: ReviewQueueFilters["source"]; label: string }[] = [
  { key: "all", label: "전체 출처" },
  { key: "user_submitted", label: "사용자 제보" },
  { key: "ai_estimated", label: "AI OCR" },
  { key: "open_db", label: "Open Food Facts" },
  { key: "public_api", label: "공공 API" },
  { key: "verified", label: "검수 완료" },
];

const RISK_FILTERS: { key: ReviewQueueFilters["risk"]; label: string }[] = [
  { key: "all", label: "전체 위험" },
  { key: "recall", label: "회수 의심" },
  { key: "allergy", label: "알레르기 의심" },
  { key: "low_confidence", label: "신뢰도 낮음" },
  { key: "nutrition_missing", label: "영양정보 부족" },
  { key: "unknown_additive", label: "미분류 첨가물" },
];

const SORT_OPTIONS: { key: ReviewQueueFilters["sort"]; label: string }[] = [
  { key: "priority_desc", label: "우선순위순" },
  { key: "created_desc", label: "최근 등록순" },
  { key: "confidence_asc", label: "신뢰도 낮은순" },
  { key: "confidence_desc", label: "신뢰도 높은순" },
];

const DATE_FILTERS: { key: ReviewQueueFilters["date"]; label: string }[] = [
  { key: "all", label: "전체 기간" },
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
];

const ADMIN_SESSION_KEY = "kfs:admin-access-code";

function confidenceSeverity(value: number) {
  if (value >= 0.9) return "good";
  if (value >= 0.7) return "normal";
  if (value >= 0.5) return "caution";
  return "danger";
}

function riskSeverity(flag: string) {
  if (flag === "recall" || flag === "allergy") return "danger";
  if (flag === "low_confidence" || flag === "unknown_additive") return "caution";
  return "info";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function AdminPage() {
  const [statusFilter, setStatusFilter] = useState<ReviewQueueListStatus>("pending");
  const [queueFilters, setQueueFilters] = useState<ReviewQueueFilters>(
    DEFAULT_REVIEW_QUEUE_FILTERS,
  );
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewProductDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);

  const visibleItems = useMemo(
    () => filterAndSortReviewQueueItems(items, queueFilters),
    [items, queueFilters],
  );

  const selected = useMemo(
    () => visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null,
    [visibleItems, selectedId],
  );

  const editedProduct = useMemo(() => {
    if (!selected || !draft) return selected?.product ?? null;
    return applyReviewProductDraft(selected.product, draft);
  }, [draft, selected]);

  const approval = useMemo(
    () => (editedProduct ? reviewApprovalCheck(editedProduct) : { ok: false, reasons: [] }),
    [editedProduct],
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      visible: visibleItems.length,
      urgent: items.filter((item) => reviewQueuePriorityOf(item) >= 80).length,
    }),
    [items, visibleItems],
  );

  const refresh = useCallback(async () => {
    if (!adminCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await listReviewQueue(adminCode, statusFilter);
      setItems(next);
      setSelectedId((current) =>
        current && next.some((item) => item.id === current) ? current : null,
      );
    } catch {
      toast.error("검수 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [adminCode, statusFilter]);

  const checkAccess = useCallback(async (code: string) => {
    setCheckingAccess(true);
    try {
      const ok = await verifyAdminAccess(code);
      if (!ok) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAdminCode("");
        return false;
      }
      sessionStorage.setItem(ADMIN_SESSION_KEY, code);
      setAdminCode(code);
      return true;
    } catch {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      setAdminCode("");
      return false;
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!saved) {
      setCheckingAccess(false);
      setLoading(false);
      return;
    }
    setCodeInput(saved);
    checkAccess(saved);
  }, [checkAccess]);

  useEffect(() => {
    if (!adminCode) return;
    refresh();
  }, [adminCode, refresh]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(reviewProductDraftFromProduct(selected.product));
  }, [selected]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await checkAccess(codeInput);
    if (!ok) {
      toast.error("관리자 접근 코드가 올바르지 않습니다");
      return;
    }
    toast.success("관리자 접근이 확인되었습니다");
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminCode("");
    setItems([]);
    setSelectedId(null);
    setDraft(null);
    setLoading(false);
  };

  const setDraftField = (key: keyof ReviewProductDraft, value: string) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const setStatus = async (item: ReviewQueueItem, status: "in_review" | "rejected") => {
    setSaving(true);
    try {
      const ok = await updateReviewStatus(
        item.id,
        status,
        adminCode,
        status === "rejected" ? "관리자 반려" : undefined,
      );
      if (!ok) throw new Error("status update failed");
      toast.success(status === "rejected" ? "반려 처리했습니다" : "검수 중으로 변경했습니다");
      await refresh();
    } catch {
      toast.error("상태 변경에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (item: ReviewQueueItem) => {
    if (!editedProduct || !approval.ok) return;
    setSaving(true);
    try {
      const ok = await approveReviewItem(item.id, editedProduct, adminCode);
      if (!ok) throw new Error("approval failed");
      toast.success("검수 완료 제품으로 승인했습니다");
      await refresh();
    } catch {
      toast.error("승인에 실패했습니다. Supabase 서비스 키와 RLS 정책을 확인하세요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="관리자 검수" back={() => history.back()}>
      <div className="py-4 md:py-6">
        {!adminCode && (
          <form
            onSubmit={login}
            className="mx-auto mt-6 max-w-md rounded-md border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex items-center gap-2">
              <LockKeyhole size={20} style={{ color: "#0F766E" }} />
              <h2 className="text-[18px] font-bold text-foreground">관리자 접근</h2>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              서버 환경변수 `ADMIN_ACCESS_CODE`와 일치하는 접근 코드를 입력하세요.
            </p>
            <Field label="접근 코드">
              <input
                type="password"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                className="h-12 w-full rounded-md border border-border-strong bg-surface px-3.5 text-[16px] text-foreground"
                autoComplete="current-password"
              />
            </Field>
            <button
              type="submit"
              disabled={checkingAccess || !codeInput.trim()}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {checkingAccess && <Loader2 size={16} className="animate-spin" />}
              접근 확인
            </button>
          </form>
        )}

        {adminCode && (
          <>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-foreground">검수 목록</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  검수 항목을 우선순위, 출처, 위험 플래그 기준으로 정리합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-[14px] font-semibold text-foreground"
                >
                  <RefreshCw size={16} />
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-[14px] font-semibold text-foreground"
                >
                  <LogOut size={16} />
                  로그아웃
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-[12px] font-semibold text-muted-foreground">현재 목록</div>
                <div className="mt-1 text-[22px] font-extrabold text-foreground">{stats.total}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-[12px] font-semibold text-muted-foreground">필터 결과</div>
                <div className="mt-1 text-[22px] font-extrabold text-foreground">
                  {stats.visible}
                </div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <div className="text-[12px] font-semibold text-muted-foreground">긴급 위험</div>
                <div className="mt-1 text-[22px] font-extrabold text-[#DC2626]">{stats.urgent}</div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {STATUS_FILTERS.map((option) => {
                const active = statusFilter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStatusFilter(option.key)}
                    className="h-9 rounded-full px-3 text-[13px] font-semibold transition-colors"
                    style={{
                      backgroundColor: active ? "#CCFBF1" : "#F1F5F9",
                      color: active ? "#115E59" : "#334155",
                    }}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-4">
              <select
                value={queueFilters.source}
                onChange={(event) =>
                  setQueueFilters((current) => ({
                    ...current,
                    source: event.target.value as ReviewQueueFilters["source"],
                  }))
                }
                className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px]"
              >
                {SOURCE_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={queueFilters.risk}
                onChange={(event) =>
                  setQueueFilters((current) => ({
                    ...current,
                    risk: event.target.value as ReviewQueueFilters["risk"],
                  }))
                }
                className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px]"
              >
                {RISK_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={queueFilters.sort}
                onChange={(event) =>
                  setQueueFilters((current) => ({
                    ...current,
                    sort: event.target.value as ReviewQueueFilters["sort"],
                  }))
                }
                className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={queueFilters.date}
                onChange={(event) =>
                  setQueueFilters((current) => ({
                    ...current,
                    date: event.target.value as ReviewQueueFilters["date"],
                  }))
                }
                className="h-10 rounded-md border border-border-strong bg-surface px-3 text-[13px]"
              >
                {DATE_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface py-12 text-sm text-muted-foreground shadow-card">
                <Loader2 size={18} className="animate-spin" />
                검수 목록 로딩 중
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-md border border-border bg-surface p-8 text-center shadow-card">
                <ClipboardList size={28} className="mx-auto text-muted-foreground" />
                <h3 className="mt-3 text-[16px] font-bold text-foreground">검수 항목이 없습니다</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  필터 조건 또는 Supabase 설정을 확인하세요.
                </p>
                <Link
                  to="/settings"
                  className="mt-4 inline-block text-[13px] font-semibold text-primary"
                >
                  설정으로 이동
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <section className="min-w-0">
                  <div className="hidden overflow-x-auto rounded-md border border-border bg-surface shadow-card md:block">
                    <table className="w-full min-w-[900px] text-left text-[13px]">
                      <thead className="border-b border-border bg-subtle text-muted-foreground">
                        <tr>
                          <th className="w-24 px-3 py-3 font-semibold">상태</th>
                          <th className="min-w-60 px-3 py-3 font-semibold">제품</th>
                          <th className="w-32 px-3 py-3 font-semibold">바코드</th>
                          <th className="w-28 px-3 py-3 font-semibold">신뢰도</th>
                          <th className="w-36 px-3 py-3 font-semibold">사유</th>
                          <th className="w-44 px-3 py-3 font-semibold">위험</th>
                          <th className="w-24 px-3 py-3 font-semibold">우선</th>
                          <th className="w-32 px-3 py-3 font-semibold">등록일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((item) => {
                          const active = selected?.id === item.id;
                          return (
                            <tr
                              key={item.id}
                              className="cursor-pointer border-b border-border last:border-b-0 hover:bg-subtle"
                              style={{ backgroundColor: active ? "#F0FDFA" : undefined }}
                              onClick={() => setSelectedId(item.id)}
                            >
                              <td className="px-3 py-3">
                                <StatusBadge
                                  severity={item.status === "rejected" ? "danger" : "info"}
                                >
                                  {item.statusLabel}
                                </StatusBadge>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-bold text-foreground">{item.product.name}</div>
                                <div className="mt-0.5 text-[12px] text-muted-foreground">
                                  {item.product.brand || "제조사 정보 없음"}
                                </div>
                              </td>
                              <td className="px-3 py-3 tabular">{item.product.barcode || "-"}</td>
                              <td className="px-3 py-3">
                                <StatusBadge severity={confidenceSeverity(item.confidence)}>
                                  {(item.confidence * 100).toFixed(0)}%
                                </StatusBadge>
                              </td>
                              <td className="px-3 py-3">{item.reasonLabel}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {item.riskLabels.length === 0
                                    ? "-"
                                    : item.riskLabels.map((risk, index) => (
                                        <StatusBadge
                                          key={`${item.id}-${risk}`}
                                          severity={riskSeverity(item.riskFlags[index])}
                                        >
                                          {risk}
                                        </StatusBadge>
                                      ))}
                                </div>
                              </td>
                              <td className="px-3 py-3 tabular">{reviewQueuePriorityOf(item)}</td>
                              <td className="px-3 py-3 tabular">
                                {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <ul className="space-y-3 md:hidden">
                    {visibleItems.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="w-full rounded-md border border-border bg-surface p-4 text-left shadow-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-foreground">{item.product.name}</h3>
                              <p className="mt-0.5 text-[12px] text-muted-foreground">
                                {item.product.brand || "제조사 정보 없음"} · {item.reasonLabel}
                              </p>
                            </div>
                            <StatusBadge severity={confidenceSeverity(item.confidence)}>
                              {(item.confidence * 100).toFixed(0)}%
                            </StatusBadge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                {selected && draft && editedProduct && (
                  <aside className="rounded-md border border-border bg-surface p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[17px] font-bold text-foreground">검수 상세</h3>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {selected.reasonLabel} · 우선순위 {reviewQueuePriorityOf(selected)}
                        </p>
                      </div>
                      <StatusBadge severity={confidenceSeverity(selected.confidence)}>
                        {(selected.confidence * 100).toFixed(0)}%
                      </StatusBadge>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <Field label="제품명">
                        <input
                          value={draft.name}
                          onChange={(event) => setDraftField("name", event.target.value)}
                          className="h-10 w-full rounded-md border border-border-strong bg-white px-3 text-[14px]"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="제조사">
                          <input
                            value={draft.brand}
                            onChange={(event) => setDraftField("brand", event.target.value)}
                            className="h-10 w-full rounded-md border border-border-strong bg-white px-3 text-[14px]"
                          />
                        </Field>
                        <Field label="바코드">
                          <input
                            value={draft.barcode}
                            onChange={(event) => setDraftField("barcode", event.target.value)}
                            className="h-10 w-full rounded-md border border-border-strong bg-white px-3 text-[14px]"
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="식품유형">
                          <input
                            value={draft.category}
                            onChange={(event) => setDraftField("category", event.target.value)}
                            className="h-10 w-full rounded-md border border-border-strong bg-white px-3 text-[14px]"
                          />
                        </Field>
                        <Field label="용량">
                          <input
                            value={draft.quantity}
                            onChange={(event) => setDraftField("quantity", event.target.value)}
                            className="h-10 w-full rounded-md border border-border-strong bg-white px-3 text-[14px]"
                          />
                        </Field>
                      </div>
                      <Field label="원재료">
                        <textarea
                          value={draft.ingredientsText}
                          onChange={(event) => setDraftField("ingredientsText", event.target.value)}
                          className="min-h-24 w-full rounded-md border border-border-strong bg-white px-3 py-2 text-[14px]"
                        />
                      </Field>
                    </div>

                    {!approval.ok && (
                      <div className="mt-4 rounded-md border border-[#FDBA74] bg-[#FFF7ED] p-3">
                        <div className="text-[13px] font-bold text-[#9A3412]">
                          승인 전 확인 필요
                        </div>
                        <ul className="mt-1 list-disc pl-5 text-[12px] leading-5 text-[#9A3412]">
                          {approval.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 space-y-2 text-[13px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">출처</span>
                        <span>{selected.product.sources.join(", ") || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">위험 플래그</span>
                        <span>{selected.riskLabels.join(", ") || "-"}</span>
                      </div>
                    </div>

                    <details className="mt-4">
                      <summary className="cursor-pointer text-[13px] font-semibold text-primary">
                        원문 JSON
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-subtle p-3 text-[11px] leading-relaxed">
                        {JSON.stringify(selected.rawPayload, null, 2)}
                      </pre>
                    </details>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setStatus(selected, "in_review")}
                        className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong bg-white text-[13px] font-semibold text-foreground disabled:opacity-50"
                      >
                        검수 중
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setStatus(selected, "rejected")}
                        className="inline-flex h-11 items-center justify-center gap-1 rounded-md border border-[#FCA5A5] bg-white text-[13px] font-semibold text-[#991B1B] disabled:opacity-50"
                      >
                        <XCircle size={15} />
                        반려
                      </button>
                      <button
                        type="button"
                        disabled={saving || !approval.ok}
                        onClick={() => approve(selected)}
                        className="inline-flex h-11 items-center justify-center gap-1 rounded-md bg-primary text-[13px] font-semibold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        승인
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
