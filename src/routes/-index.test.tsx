import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppHomePage, HomePage, RecentScanList } from "@/components/HomePage";
import type { Product } from "@/lib/types";

const recentProducts = vi.hoisted(() => ({ value: [] as Product[] }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  lazyRouteComponent: () => vi.fn(),
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: {
    children: React.ReactNode;
    params?: { id?: string };
    search?: Record<string, string>;
    to: string;
  }) => {
    const pathname = to.replace("$id", params?.id ?? "");
    const query = search ? new URLSearchParams(search).toString() : "";
    return (
      <a href={`${pathname}${query ? `?${query}` : ""}`} {...props}>
        {children}
      </a>
    );
  },
  useLocation: () => ({ pathname: "/app" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  DEFAULT_PREFS: { foodAlerts: [], dietaryPreferences: [] },
  getPrefs: () => ({ foodAlerts: [], dietaryPreferences: [] }),
  getRecent: () => recentProducts.value,
}));

const product: Product = {
  id: "8801234567890",
  barcode: "8801234567890",
  name: "Test snack",
  brand: "Test brand",
  ingredients: [],
  allergens: [],
  additives: [],
  nutrition: { energyKcal: 120, sodiumMg: 80, sugarsG: 4, saturatedFatG: 0.5 },
  sources: ["public_api"],
  status: "public_matched",
  confidence: 0.8,
  updatedAt: "2026-05-14T00:00:00.000Z",
};

beforeEach(() => {
  recentProducts.value = [];
});

describe("home scan actions", () => {
  it("renders the landing CTA to the app home", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain('href="/app"');
    expect(markup).toContain("식품 안전, 이제 스마트하게 스캔하세요");
  });

  it("shows only the barcode scan entry point", () => {
    const markup = renderToStaticMarkup(<AppHomePage />);

    expect(markup).toContain('href="/scan?mode=barcode"');
    expect(markup).not.toContain('href="/scan?mode=photo"');
  });

  it("links the sidebar brand text back to the landing home", () => {
    const markup = renderToStaticMarkup(<AppHomePage />);

    expect(markup).toContain('aria-label="홈 화면으로 이동"');
    expect(markup).toContain('href="/"');
  });

  it("does not render local recent storage during the initial server pass", () => {
    recentProducts.value = [product];

    const markup = renderToStaticMarkup(<AppHomePage />);

    expect(markup).not.toContain("/product/8801234567890");
  });

  it("renders recent scan list cards in the cached history product view", () => {
    const markup = renderToStaticMarkup(<RecentScanList recent={[product]} />);

    expect(markup).toContain('href="/product/8801234567890?view=history"');
  });
});
