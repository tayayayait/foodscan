import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: {
    children: React.ReactNode;
    params?: { id?: string };
    search?: { view?: string };
    to: string;
  }) => {
    const href = `${to.replace("$id", params?.id ?? "")}${search?.view ? `?view=${search.view}` : ""}`;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

const product: Product = {
  id: "8801234567890",
  barcode: "8801234567890",
  name: "테스트 과자",
  brand: "테스트 식품",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: { energyKcal: 120, sodiumMg: 80, sugarsG: 4, saturatedFatG: 0.5 },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.8,
  updatedAt: "2026-05-14T00:00:00.000Z",
};

describe("ProductCard", () => {
  it("links history cards to the cached product view", () => {
    const markup = renderToStaticMarkup(<ProductCard product={product} linkView="history" />);

    expect(markup).toContain('href="/product/8801234567890?view=history"');
  });
});
