import { HACCP_PACKAGING_URL } from "./runtime.ts";
import { getPublicDataApiKey, normalizeServiceKey } from "./public-data-api.ts";
import type { ApiResult, HaccpPackagingResponse } from "./types.ts";

export const fetchHaccpPackagingApi = async <T>(
  params: Record<string, string | number | undefined> = {},
): Promise<ApiResult<T>> => {
  const apiKey = getPublicDataApiKey();
  if (!apiKey) {
    return {
      ok: false,
      rows: [],
      code: "NO_API_KEY",
      message: "PUBLIC_DATA_API_KEY is not configured",
    };
  }

  const url = new URL(HACCP_PACKAGING_URL);
  url.searchParams.set("ServiceKey", normalizeServiceKey(apiKey));
  url.searchParams.set("returnType", "json");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim().length > 0) {
      url.searchParams.set(key, String(value));
    }
  });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        rows: [],
        code: String(response.status),
        message: response.statusText,
      };
    }

    const payload = (await response.json()) as HaccpPackagingResponse<T>;
    const code = payload.header?.resultCode;
    const message = payload.header?.resultMessage;
    const items = payload.body?.items;
    const rows = Array.isArray(items)
      ? items.map((entry) => entry.item).filter((item): item is T => Boolean(item))
      : Array.isArray(items?.item)
        ? items.item
        : items?.item
          ? [items.item]
          : [];

    if (code === "OK") {
      return { ok: true, rows, code, message };
    }

    return { ok: false, rows: [], code, message };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      code: "FETCH_ERROR",
      message: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
};
