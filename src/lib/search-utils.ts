import type { Product, SourceTag } from "./types";

export type SearchSourceFilter = "all" | SourceTag;
export type SearchSort = "relevance" | "recent" | "confidence_desc" | "risk_low";

export interface SearchFilters {
  source: SearchSourceFilter;
  category: string;
  sort: SearchSort;
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

const riskWeight = (product: Product) => {
  let risk = 0;
  if (product.recall) risk += 4;
  if (product.allergens.length > 0) risk += 2;
  if (Object.keys(product.nutrition).length === 0) risk += 1;
  return risk;
};

export function filterAndSortProducts(products: Product[], filters: SearchFilters): Product[] {
  const filtered = products.filter((product) => {
    const sourceOk = filters.source === "all" || product.sources.includes(filters.source);
    const categoryOk = !filters.category || product.category === filters.category;
    return sourceOk && categoryOk;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === "confidence_desc") return b.confidence - a.confidence;
    if (filters.sort === "recent") return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (filters.sort === "risk_low") return riskWeight(a) - riskWeight(b);
    return b.confidence - a.confidence;
  });
}

export function detectAmbiguousCandidates(products: Product[], threshold = 0.15): Product[] {
  const sorted = [...products].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  if (sorted.length < 2) return [];

  const top = sorted[0];
  const ambiguous = sorted.filter((product) => top.confidence - product.confidence < threshold);
  return ambiguous.length >= 2 ? ambiguous : [];
}

export function highlightMatchParts(text: string, query: string): HighlightPart[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [{ text, match: false }];

  const index = text.toLocaleLowerCase().indexOf(normalizedQuery.toLocaleLowerCase());
  if (index < 0) return [{ text, match: false }];

  const end = index + normalizedQuery.length;
  return [
    ...(index > 0 ? [{ text: text.slice(0, index), match: false }] : []),
    { text: text.slice(index, end), match: true },
    ...(end < text.length ? [{ text: text.slice(end), match: false }] : []),
  ];
}

export function uniqueCategories(products: Product[]) {
  return [...new Set(products.map((product) => product.category).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
}
