import { describe, expect, it } from "vitest";
import { haccpPackagingFromRow, normalizeHaccpPackagingItems } from "./haccp-packaging.ts";

describe("HACCP packaging normalization", () => {
  it("normalizes the nested items array returned by the packaging API", () => {
    expect(
      normalizeHaccpPackagingItems({
        items: [
          {
            item: {
              prdlstReportNo: "2002046408866",
              rawmtrl: "물엿, 고추양념, 쌀",
            },
          },
        ],
      }),
    ).toEqual([
      {
        prdlstReportNo: "2002046408866",
        rawmtrl: "물엿, 고추양념, 쌀",
      },
    ]);
  });

  it("maps packaging rows into label enrichment data", () => {
    expect(
      haccpPackagingFromRow({
        prdlstReportNo: "2002046408866",
        rawmtrl: "물엿, 고추양념, 쌀",
        allergy: "대두 함유",
        imgurl1: "https://example.com/product.jpg",
        capacity: "1kg",
      }),
    ).toEqual({
      reportNo: "2002046408866",
      ingredientsText: "물엿, 고추양념, 쌀",
      ingredients: ["물엿", "고추양념", "쌀"],
      allergens: ["대두 함유"],
      imageUrl: "https://example.com/product.jpg",
      quantity: "1kg",
    });
  });
});
