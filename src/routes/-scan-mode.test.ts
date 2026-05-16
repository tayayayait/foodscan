import { describe, expect, it } from "vitest";
import { Route } from "./scan";

describe("scan route search params", () => {
  it("defaults to barcode mode when no mode is provided", () => {
    expect(Route.options.validateSearch.parse({})).toEqual({ mode: "barcode" });
  });

  it("accepts only barcode mode", () => {
    expect(Route.options.validateSearch.parse({ mode: "barcode" })).toEqual({ mode: "barcode" });
    expect(() => Route.options.validateSearch.parse({ mode: "photo" })).toThrow();
  });
});
