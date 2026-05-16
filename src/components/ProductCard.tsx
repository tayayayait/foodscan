import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/types";
import { computeScore } from "@/lib/score";
import { DEFAULT_PREFS, getPrefs } from "@/lib/storage";
import { StatusBadge } from "./Badges";
import { AlertTriangle } from "lucide-react";
import { highlightMatchParts } from "@/lib/search-utils";

function HighlightedText({ text, query }: { text: string; query?: string }) {
  return (
    <>
      {highlightMatchParts(text, query ?? "").map((part, index) =>
        part.match ? (
          <mark key={`${part.text}-${index}`} className="rounded-[3px] bg-[#FEF9C3] px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function ProductCard({
  product,
  highlightQuery,
  linkView,
}: {
  product: Product;
  highlightQuery?: string;
  linkView?: "history";
}) {
  const prefs = typeof window !== "undefined" ? getPrefs() : DEFAULT_PREFS;
  const score = computeScore(product, prefs);
  return (
    <Link
      to="/product/$id"
      params={{ id: product.id }}
      search={linkView === "history" ? { view: "history" } : undefined}
      className="block bg-surface border border-border rounded-md p-4 shadow-card hover:border-border-strong transition-colors"
      style={{ minHeight: 88 }}
    >
      <div className="flex gap-3">
        <div
          className="flex-shrink-0 bg-subtle rounded-[6px] overflow-hidden flex items-center justify-center"
          style={{ width: 56, height: 56 }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={`${product.name} 제품 이미지`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">이미지 없음</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-bold text-foreground line-clamp-2"
              style={{ fontSize: 15, lineHeight: "20px" }}
            >
              <HighlightedText text={product.name} query={highlightQuery} />
            </h3>
            {score.computable && score.score !== null && (
              <StatusBadge severity={score.severity}>
                {score.score} {score.grade}
              </StatusBadge>
            )}
          </div>
          <p
            className="mt-0.5 truncate"
            style={{ fontSize: 13, lineHeight: "18px", color: "#64748B" }}
          >
            <HighlightedText text={product.brand || "제조사 정보 없음"} query={highlightQuery} />
          </p>
          {product.recall && (
            <div
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold"
              style={{ color: "#991B1B" }}
            >
              <AlertTriangle size={14} />
              회수 이력 있음
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
