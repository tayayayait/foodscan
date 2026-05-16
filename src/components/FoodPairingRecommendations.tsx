import { AlertTriangle, Sparkles } from "lucide-react";
import type { FoodPairingJudgement } from "@/lib/types";

function SectionHeading() {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[18px] font-bold">함께 먹기 좋은 조합</h2>
      <span className="text-[12px] text-muted-foreground">Gemini 영양 판단</span>
    </div>
  );
}

export function FoodPairingRecommendations({
  judgement,
  loading,
  error,
}: {
  judgement: FoodPairingJudgement | null;
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <section className="space-y-2" aria-label="함께 먹기 좋은 조합">
        <SectionHeading />
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[108px] animate-pulse rounded-md bg-subtle" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-2" aria-label="함께 먹기 좋은 조합">
        <SectionHeading />
        <div className="rounded-md border border-border bg-surface p-4 text-[14px] text-muted-foreground shadow-card">
          AI 조합 추천을 불러오지 못했습니다.
        </div>
      </section>
    );
  }

  const pairings = judgement?.pairings ?? [];
  if (pairings.length === 0) {
    return (
      <section className="space-y-2" aria-label="함께 먹기 좋은 조합">
        <SectionHeading />
        <div className="rounded-md border border-border bg-surface p-4 text-[14px] text-muted-foreground shadow-card">
          {judgement?.warnings[0] ?? "추천할 수 있는 조합 근거가 부족합니다."}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2" aria-label="함께 먹기 좋은 조합">
      <SectionHeading />
      <div className="rounded-md border border-border bg-surface p-4 shadow-card">
        {judgement?.overallStrategy && (
          <div className="mb-3 flex gap-2 rounded-md bg-subtle p-3">
            <Sparkles size={17} className="mt-0.5 flex-shrink-0 text-primary" />
            <p className="text-[13px] leading-5 text-muted-foreground">
              {judgement.overallStrategy}
            </p>
          </div>
        )}
        <div className="space-y-3">
          {pairings.map((pairing) => (
            <article key={pairing.foods.join("|")} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-[15px] font-bold leading-5">
                  {pairing.foods.join(" + ")}
                </h3>
                <span className="flex-shrink-0 rounded-[4px] bg-[#ECFDF5] px-2 py-1 text-[12px] font-bold text-[#047857]">
                  {pairing.fitScore}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{pairing.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pairing.nutritionFocus.map((focus) => (
                  <span
                    key={focus}
                    className="rounded-[4px] bg-subtle px-2 py-1 text-[12px] font-semibold text-muted-foreground"
                  >
                    {focus}
                  </span>
                ))}
              </div>
              {pairing.caution && (
                <p className="mt-2 flex gap-1.5 text-[12px] leading-5 text-[#9A3412]">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  {pairing.caution}
                </p>
              )}
            </article>
          ))}
        </div>
        {judgement?.warnings.length ? (
          <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
            {judgement.warnings.join(" ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
