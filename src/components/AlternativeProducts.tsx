import { Link } from "@tanstack/react-router";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { StatusBadge } from "./Badges";
import type { AlternativeRecommendation } from "@/lib/alternatives";

function priceText(recommendation: AlternativeRecommendation) {
  return recommendation.product.shoppingOffer?.priceText;
}

function RecommendationFrame({
  recommendation,
  children,
}: {
  recommendation: AlternativeRecommendation;
  children: React.ReactNode;
}) {
  const href = recommendation.product.shoppingOffer?.link;
  const className =
    "block rounded-md border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link to="/product/$id" params={{ id: recommendation.product.id }} className={className}>
      {children}
    </Link>
  );
}

export function AlternativeProducts({
  recommendations,
  loading,
}: {
  recommendations: AlternativeRecommendation[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="space-y-2" aria-label="대체상품 추천">
        <h2 className="text-[18px] font-bold">대체상품 추천</h2>
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-[124px] rounded-md bg-subtle animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section className="space-y-2" aria-label="대체상품 추천">
        <h2 className="text-[18px] font-bold">대체상품 추천</h2>
        <div className="rounded-md border border-border bg-surface p-4 text-[14px] text-muted-foreground shadow-card">
          추천할 만큼 신뢰할 수 있는 대체상품이 없습니다.
        </div>
      </section>
    );
  }

  const sourceLabel = recommendations.some((recommendation) => recommendation.kind === "shopping")
    ? "Gemini 영양 판단·네이버쇼핑"
    : "Gemini 판단·공공 영양DB";

  return (
    <section className="space-y-2" aria-label="대체상품 추천">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-bold">대체상품 추천</h2>
        <span className="text-[12px] text-muted-foreground">{sourceLabel}</span>
      </div>
      <div className="space-y-2">
        {recommendations.map((recommendation) => {
          const { product } = recommendation;
          const offerPrice = priceText(recommendation);
          return (
            <RecommendationFrame key={product.id} recommendation={recommendation}>
              <div className="flex gap-3">
                <div
                  className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-subtle"
                  style={{ width: 62, height: 62 }}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={`${product.name} 제품 이미지`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">이미지 없음</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-foreground">
                      {product.name}
                    </h3>
                    {recommendation.score !== null && recommendation.grade !== null ? (
                      <StatusBadge severity={recommendation.score >= 70 ? "good" : "normal"}>
                        {recommendation.score} {recommendation.grade}
                      </StatusBadge>
                    ) : (
                      <StatusBadge severity="info">
                        <ShoppingCart size={12} /> 가격
                      </StatusBadge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] leading-[18px] text-muted-foreground">
                    {product.brand || "제조사 정보 없음"}
                    {product.shoppingOffer?.mallName ? ` · ${product.shoppingOffer.mallName}` : ""}
                  </p>
                  {offerPrice && (
                    <div className="mt-2 flex items-center gap-1.5 text-[14px] font-extrabold text-primary">
                      <span>{offerPrice}</span>
                      {product.shoppingOffer?.link && <ExternalLink size={13} />}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {recommendation.scoreDelta !== null && (
                      <span className="rounded-[4px] bg-[#ECFDF5] px-2 py-1 text-[12px] font-bold text-[#047857]">
                        +{recommendation.scoreDelta}점
                      </span>
                    )}
                    {recommendation.reasons.slice(0, 3).map((reason) => (
                      <span
                        key={reason}
                        className="rounded-[4px] bg-subtle px-2 py-1 text-[12px] font-semibold text-muted-foreground"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </RecommendationFrame>
          );
        })}
      </div>
    </section>
  );
}
