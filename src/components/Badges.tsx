import type { Severity, SourceTag } from "@/lib/types";

const SEV_BG: Record<Severity, string> = {
  good: "#DCFCE7",
  normal: "#FEF9C3",
  caution: "#FFEDD5",
  danger: "#FEE2E2",
  info: "#E2E8F0",
};

const SEV_FG: Record<Severity, string> = {
  good: "#166534",
  normal: "#854D0E",
  caution: "#9A3412",
  danger: "#991B1B",
  info: "#334155",
};

export function StatusBadge({
  severity,
  children,
}: {
  severity: Severity;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 rounded-[4px] text-[12px] font-semibold"
      style={{
        height: 24,
        backgroundColor: SEV_BG[severity],
        color: SEV_FG[severity],
      }}
    >
      {children}
    </span>
  );
}

const SOURCE_LABELS: Record<SourceTag, { label: string; sev: Severity }> = {
  verified: { label: "검증 완료", sev: "good" },
  public_api: { label: "공공 API", sev: "info" },
  open_db: { label: "공개 DB", sev: "info" },
  ai_estimated: { label: "AI 추정", sev: "caution" },
  user_submitted: { label: "사용자 제보", sev: "info" },
  shopping: { label: "쇼핑 검색", sev: "info" },
};

export function SourceBadge({ source }: { source: SourceTag }) {
  const s = SOURCE_LABELS[source];
  return (
    <span
      className="inline-flex items-center px-1.5 rounded-[4px] text-[12px] font-medium"
      style={{
        height: 22,
        backgroundColor: SEV_BG[s.sev],
        color: SEV_FG[s.sev],
      }}
    >
      {s.label}
    </span>
  );
}
