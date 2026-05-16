import { describe, expect, it } from "vitest";
import { createPublicProduct, normalizePackageQuantity } from "./normalizers.ts";

describe("package quantity normalization", () => {
  it("drops shelf-life text that is not a sellable package quantity", () => {
    expect(
      normalizePackageQuantity("\uC81C\uC870\uC77C\uB85C\uBD80\uD130 12\uAC1C\uC6D4"),
    ).toBeUndefined();

    const product = createPublicProduct({
      id: "8801037088182",
      barcode: "8801037088182",
      reportNo: "19960399065283",
      name: "Oreo Chocolate Sandwich Cookies",
      brand: "Oreo",
      category: "Snack",
      quantity: "\uC81C\uC870\uC77C\uB85C\uBD80\uD130 12\uAC1C\uC6D4",
      confidence: 0.92,
    });

    expect(product.quantity).toBeUndefined();
  });

  it("keeps normal weight and count quantities", () => {
    expect(normalizePackageQuantity("100g")).toBe("100g");
    expect(normalizePackageQuantity("24\uAC1C")).toBe("24\uAC1C");
  });
});
