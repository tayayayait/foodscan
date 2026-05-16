import { afterEach, describe, expect, it, vi } from "vitest";
import { callAppEdgeFunction, readAppEdgeFunctionConfig } from "./edge-function-client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("edge function client config", () => {
  it("builds the app-api URL from a Supabase project URL", () => {
    expect(
      readAppEdgeFunctionConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co/",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co/functions/v1/app-api",
      apiKey: "anon-key",
    });
  });

  it("appends the app-api function name to a functions base URL", () => {
    expect(
      readAppEdgeFunctionConfig({
        VITE_SUPABASE_FUNCTIONS_URL: "https://example.supabase.co/functions/v1/",
      }),
    ).toEqual({
      url: "https://example.supabase.co/functions/v1/app-api",
      apiKey: undefined,
    });
  });

  it("keeps an explicit app edge function URL unchanged", () => {
    expect(
      readAppEdgeFunctionConfig({
        VITE_APP_EDGE_FUNCTION_URL: "https://edge.example.test/app-api/",
      }),
    ).toEqual({
      url: "https://edge.example.test/app-api",
      apiKey: undefined,
    });
  });

  it("falls back to the linked Supabase project when no URL env exists", () => {
    expect(readAppEdgeFunctionConfig({})).toEqual({
      url: "https://opfgbkxihitvynojozxu.supabase.co/functions/v1/app-api",
      apiKey: undefined,
    });
  });

  it("aborts an edge function request when the configured timeout elapses", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const request = callAppEdgeFunction("translateProductToKorean", {}, { timeoutMs: 100 });
    const assertion = expect(request).rejects.toMatchObject({
      name: "AppEdgeFunctionError",
      status: 0,
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(100);

    await assertion;
  });

  it("deduplicates concurrent identical lookup requests", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { name: "matched product" } }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      callAppEdgeFunction("lookupC005", { barcode: "8801043014809" }),
      callAppEdgeFunction("lookupC005", { barcode: "8801043014809" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ name: "matched product" });
    expect(second).toEqual({ name: "matched product" });
  });

  it("does not deduplicate mutating requests", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      callAppEdgeFunction("enqueueAdditiveReview", { additiveName: "unknown", productId: "p1" }),
      callAppEdgeFunction("enqueueAdditiveReview", { additiveName: "unknown", productId: "p1" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
