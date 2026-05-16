import { describe, expect, it } from "vitest";
import {
  TRUST_PRINCIPLES,
  buildLocalDataInventory,
  dataSourceTiers,
  trustPrincipleByKey,
} from "./trust-center";

describe("trust center", () => {
  it("states independence and no commercial sale of scan history", () => {
    expect(TRUST_PRINCIPLES).toContainEqual(
      expect.objectContaining({
        key: "independent_scoring",
        title: "독립 점수",
      }),
    );
    expect(TRUST_PRINCIPLES).toContainEqual(
      expect.objectContaining({
        key: "no_commercial_sale",
        body: expect.stringContaining("판매하거나 공유하지 않습니다"),
      }),
    );
    expect(trustPrincipleByKey("no_sponsored_recommendations")?.body).toContain("후원 상품");
  });

  it("describes source tiers from verified data to user-submitted data", () => {
    const tiers = dataSourceTiers();

    expect(tiers.map((tier) => tier.key)).toEqual([
      "verified",
      "public_api",
      "open_db",
      "ai_estimated",
      "user_submitted",
    ]);
    expect(tiers[0]).toEqual(
      expect.objectContaining({
        label: "검수 완료",
        scoreUse: "확정 평가",
      }),
    );
    expect(tiers[4].scoreUse).toBe("검수 전 평가");
  });

  it("builds a local data inventory with counts and reset behavior", () => {
    const inventory = buildLocalDataInventory({
      recentCount: 3,
      savedCount: 2,
      provisionalCount: 1,
      hasPreferences: true,
      ocrDraftCount: 4,
      recentSearchCount: 5,
    });

    expect(inventory.map((item) => item.key)).toEqual([
      "recent",
      "saved",
      "provisional",
      "preferences",
      "ocrDrafts",
      "recentSearches",
    ]);
    expect(inventory.find((item) => item.key === "saved")).toEqual(
      expect.objectContaining({
        label: "저장 제품",
        countLabel: "2개",
        clearedByLocalReset: true,
      }),
    );
    expect(inventory.find((item) => item.key === "preferences")?.countLabel).toBe("설정됨");
  });
});
