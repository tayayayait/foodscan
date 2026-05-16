import { AlertTriangle, CheckCircle2, Loader2, Minus } from "lucide-react";
import type { StageState } from "@/lib/lookup";

export function LoadingSteps({ stages }: { stages: StageState[] }) {
  return (
    <div className="bg-surface border border-border rounded-md p-4 shadow-card">
      <h2 className="text-base font-bold mb-3 text-foreground">제품 정보를 확인 중입니다</h2>
      <ol className="space-y-2.5">
        {stages.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {s.status === "ok" && <CheckCircle2 size={18} style={{ color: "#16A34A" }} />}
              {s.status === "running" && (
                <Loader2 size={18} className="animate-spin" style={{ color: "#0F766E" }} />
              )}
              {s.status === "fail" && <AlertTriangle size={18} style={{ color: "#F97316" }} />}
              {s.status === "skipped" && <Minus size={18} style={{ color: "#94A3B8" }} />}
              {s.status === "pending" && <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" />}
            </span>
            <span
              className={
                s.status === "skipped" || s.status === "fail"
                  ? "text-muted-foreground"
                  : "text-foreground"
              }
            >
              {i + 1}. {s.label}
            </span>
            {s.status === "skipped" && (
              <span className="ml-auto text-[12px] text-muted-foreground">
                {s.message ?? "건너뜀"}
              </span>
            )}
            {s.status === "fail" && (
              <span className="ml-auto text-[12px]" style={{ color: "#F97316" }}>
                {s.message ?? "조회 실패"}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
