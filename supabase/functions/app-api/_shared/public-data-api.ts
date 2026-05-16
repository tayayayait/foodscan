import { env } from "./runtime.ts";
import type { ApiResult, PublicDataResponse } from "./types.ts";

export const getPublicDataApiKey = () => {
  const currentEnv = env();
  return (
    currentEnv.PUBLIC_DATA_API_KEY ||
    currentEnv.DATA_GO_KR_API_KEY ||
    currentEnv.PUBLIC_DATA_SERVICE_KEY ||
    ""
  );
};

export const normalizeServiceKey = (apiKey: string) => {
  try {
    return decodeURIComponent(apiKey);
  } catch {
    return apiKey;
  }
};

export const normalizePublicItems = <T>(items: T[] | { item?: T | T[] } | undefined): T[] => {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (Array.isArray(items.item)) return items.item;
  return items.item ? [items.item] : [];
};

export const fetchPublicDataApi = async <T>(
  endpoint: string,
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

  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", normalizeServiceKey(apiKey));
  url.searchParams.set("type", "json");
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

    const payload = (await response.json()) as PublicDataResponse<T>;
    const header = payload.response?.header ?? payload.header;
    const body = payload.response?.body ?? payload.body;
    const code = header?.resultCode;
    const message = header?.resultMsg;
    const rows = normalizePublicItems<T>(body?.items);

    if (!code || code === "00") {
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
