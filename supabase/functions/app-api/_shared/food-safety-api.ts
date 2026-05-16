import { FOOD_SAFETY_BASE, HttpError, env } from "./runtime.ts";
import { htmlToText } from "./normalizers.ts";
import type { ApiResult, FoodSafetyResponse } from "./types.ts";

export const API_LIMIT_EXCEEDED_CODE = "API_LIMIT_EXCEEDED";

export const getFoodSafetyApiKey = () => {
  const currentEnv = env();
  return (
    currentEnv.FOOD_SAFETY_API_KEY ||
    currentEnv.MFDS_FOOD_SAFETY_API_KEY ||
    currentEnv.MFDS_API_KEY ||
    ""
  );
};

export const buildFoodSafetyUrl = (
  serviceId: string,
  startIdx: number,
  endIdx: number,
  params: Record<string, string | undefined> = {},
) => {
  const apiKey = getFoodSafetyApiKey();
  const paramString = Object.entries(params)
    .filter(([, value]) => value && value.trim().length > 0)
    .map(([key, value]) => `${key}=${encodeURIComponent(value ?? "")}`)
    .join("&");

  return `${FOOD_SAFETY_BASE}/${apiKey}/${serviceId}/json/${startIdx}/${endIdx}${
    paramString ? `/${paramString}` : ""
  }`;
};

export const fetchFoodSafetyApi = async <T>(
  serviceId: string,
  startIdx: number,
  endIdx: number,
  params: Record<string, string | undefined> = {},
): Promise<ApiResult<T>> => {
  if (!getFoodSafetyApiKey()) {
    return {
      ok: false,
      rows: [],
      code: "NO_API_KEY",
      message: "FOOD_SAFETY_API_KEY is not configured",
    };
  }

  try {
    const response = await fetch(buildFoodSafetyUrl(serviceId, startIdx, endIdx, params));
    if (!response.ok) {
      return {
        ok: false,
        rows: [],
        code: String(response.status),
        message: response.statusText,
      };
    }

    const responseText = await response.text();
    let payload: FoodSafetyResponse<T>;
    try {
      payload = JSON.parse(responseText) as FoodSafetyResponse<T>;
    } catch {
      return {
        ok: false,
        rows: [],
        code: "INVALID_RESPONSE",
        message: htmlToText(responseText).slice(0, 300),
      };
    }
    const service = payload[serviceId];
    const code = service?.RESULT?.CODE;
    const message = service?.RESULT?.MSG;

    if (code === "INFO-000" || code === "INFO-200") {
      return { ok: true, rows: service?.row ?? [], code, message };
    }

    if (code === "INFO-300") {
      throw new HttpError(
        message || "식품안전나라 API 호출 한도를 초과했습니다.",
        429,
        API_LIMIT_EXCEEDED_CODE,
      );
    }

    return { ok: false, rows: [], code, message };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return {
      ok: false,
      rows: [],
      code: "FETCH_ERROR",
      message: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
};
