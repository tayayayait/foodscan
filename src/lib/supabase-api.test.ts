import { describe, expect, it } from "vitest";
import { buildSupabaseHeaders, buildSupabaseRestUrl, readSupabaseConfig } from "./supabase-api";

describe("supabase api helpers", () => {
  it("reads Supabase REST config from server env and prefers service role key", () => {
    const config = readSupabaseConfig({
      SUPABASE_REST_URL: "https://example.supabase.co/rest/v1/",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });

    expect(config).toEqual({
      restUrl: "https://example.supabase.co/rest/v1",
      apiKey: "service-key",
      hasServiceRole: true,
    });
  });

  it("returns null when URL or key is missing", () => {
    expect(readSupabaseConfig({ SUPABASE_REST_URL: "https://example.supabase.co/rest/v1" })).toBe(
      null,
    );
    expect(readSupabaseConfig({ SUPABASE_ANON_KEY: "anon-key" })).toBe(null);
  });

  it("builds REST URLs and authenticated headers", () => {
    const config = {
      restUrl: "https://example.supabase.co/rest/v1",
      apiKey: "secret",
      hasServiceRole: false,
    };

    expect(buildSupabaseRestUrl(config, "products", { id: "eq.8801234567890" })).toBe(
      "https://example.supabase.co/rest/v1/products?id=eq.8801234567890",
    );
    expect(buildSupabaseHeaders(config, "return=representation")).toEqual({
      apikey: "secret",
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    });
  });
});
