import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { SearchInput } from "@/components/SearchInput";
import { ProductCard } from "@/components/ProductCard";
import { lookupSearch } from "@/lib/lookup";
import { getRecent, getRecentSearches, pushRecent, pushRecentSearch } from "@/lib/storage";
import type { Product, SourceTag } from "@/lib/types";
import {
  detectAmbiguousCandidates,
  filterAndSortProducts,
  uniqueCategories,
  type SearchFilters,
  type SearchSort,
  type SearchSourceFilter,
} from "@/lib/search-utils";
import { Filter, Loader2 } from "lucide-react";

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional().default("") }),
  head: () => ({
    meta: [
      { title: "검색 — 식품 스캔" },
      { name: "description", content: "제품명으로 식품을 검색합니다." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const nav = useNavigate();
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    source: "all",
    category: "",
    sort: "relevance",
  });

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    pushRecentSearch(q);
    setRecentSearches(getRecentSearches());
    lookupSearch(q).then((r) => {
      setResults(r);
      setLoading(false);
    });
  }, [q]);

  const localCandidateSuggestions = getRecent()
    .filter((product) => {
      if (!q) return true;
      const target = `${product.name} ${product.brand ?? ""}`.toLocaleLowerCase();
      return target.includes(q.toLocaleLowerCase());
    })
    .map((product) => product.name)
    .slice(0, 5);
  const suggestions = [...new Set([...recentSearches, ...localCandidateSuggestions])].slice(0, 10);
  const categories = uniqueCategories(results);
  const visibleResults = filterAndSortProducts(results, filters);
  const ambiguousCandidates = detectAmbiguousCandidates(visibleResults);

  const setSource = (source: SearchSourceFilter) =>
    setFilters((current) => ({ ...current, source }));
  const setCategory = (category: string) => setFilters((current) => ({ ...current, category }));
  const setSort = (sort: SearchSort) => setFilters((current) => ({ ...current, sort }));
  const submitSearch = (v: string) => {
    pushRecentSearch(v);
    setRecentSearches(getRecentSearches());
    nav({ to: "/search", search: { q: v } });
  };

  return (
    <AppShell title="검색" back={() => history.back()}>
      <div className="pt-4">
        <SearchInput
          defaultValue={q}
          autoFocus={!q}
          suggestions={suggestions}
          onSubmit={submitSearch}
        />
      </div>
      <div className="mt-4">
        {!q && (
          <p className="text-[14px]" style={{ color: "#64748B" }}>
            제품명, 제조사 또는 바코드를 입력해주세요.
          </p>
        )}
        {q && loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="animate-spin" size={18} />
            검색 중…
          </div>
        )}
        {q && !loading && results.length === 0 && (
          <div className="bg-surface border border-border rounded-md p-6 text-center shadow-card mt-2">
            <h3 className="text-[16px] font-bold">제품을 찾지 못했습니다</h3>
            <p className="mt-1 text-[14px]" style={{ color: "#64748B" }}>
              직접 입력으로 임시 제품을 등록할 수 있습니다
            </p>
            <button
              onClick={() => nav({ to: "/register", search: {} })}
              className="inline-flex items-center justify-center mt-4 px-4 rounded-md font-semibold text-white"
              style={{ height: 44, backgroundColor: "#0F766E", fontSize: 15 }}
            >
              직접 입력으로 등록
            </button>
          </div>
        )}
        {q && !loading && results.length > 0 && (
          <>
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Filter size={15} />
                검색 필터
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "전체"],
                  ["verified", "검수 완료"],
                  ["public_api", "공공데이터"],
                  ["open_db", "Open Food Facts"],
                  ["ai_estimated", "AI 추정"],
                ].map(([key, label]) => {
                  const active = filters.source === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSource(key as SearchSourceFilter)}
                      className="h-8 rounded-full px-3 text-[12px] font-semibold"
                      style={{
                        backgroundColor: active ? "#CCFBF1" : "#F1F5F9",
                        color: active ? "#115E59" : "#334155",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory("")}
                    className="h-8 rounded-full px-3 text-[12px] font-semibold"
                    style={{
                      backgroundColor: filters.category === "" ? "#CCFBF1" : "#F1F5F9",
                      color: filters.category === "" ? "#115E59" : "#334155",
                    }}
                  >
                    모든 카테고리
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setCategory(category)}
                      className="h-8 rounded-full px-3 text-[12px] font-semibold"
                      style={{
                        backgroundColor: filters.category === category ? "#CCFBF1" : "#F1F5F9",
                        color: filters.category === category ? "#115E59" : "#334155",
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {[
                  ["relevance", "관련도순"],
                  ["recent", "최근순"],
                  ["confidence_desc", "신뢰도순"],
                  ["risk_low", "위험 낮은순"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key as SearchSort)}
                    className="h-8 rounded-full px-3 text-[12px] font-semibold"
                    style={{
                      backgroundColor: filters.sort === key ? "#CCFBF1" : "#F1F5F9",
                      color: filters.sort === key ? "#115E59" : "#334155",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {ambiguousCandidates.length > 0 && (
              <div className="mb-3 rounded-md border border-[#FDBA74] bg-[#FFEDD5] p-3">
                <p className="text-[13px] font-bold" style={{ color: "#9A3412" }}>
                  유사한 후보가 여러 개 있습니다
                </p>
                <ul className="mt-2 space-y-2">
                  {ambiguousCandidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => {
                          pushRecent(candidate);
                          nav({ to: "/product/$id", params: { id: candidate.id } });
                        }}
                        className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-[13px] font-semibold"
                      >
                        <span>{candidate.name}</span>
                        <span className="tabular text-muted-foreground">
                          {(candidate.confidence * 100).toFixed(0)}%
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mb-2 text-[13px]" style={{ color: "#64748B" }}>
              {visibleResults.length}개 결과 · 필터 적용
            </p>
            <ul className="space-y-3">
              {visibleResults.map((p) => (
                <li key={p.id} onClick={() => pushRecent(p)}>
                  <ProductCard product={p} highlightQuery={q} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
