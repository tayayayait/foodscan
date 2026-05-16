const APP_EDGE_FUNCTION_NAME = "app-api";
const DEFAULT_SUPABASE_PROJECT_ID = "opfgbkxihitvynojozxu";
const DEDUPED_READ_ACTIONS = new Set([
  "lookupC005",
  "lookupI2570",
  "lookupC002",
  "searchI1250",
  "lookupNutritionStandard",
  "lookupIngredientInfo",
  "lookupAdditiveInfo",
  "explainAdditiveTerms",
  "searchOpenFoodFacts",
  "lookupOpenFoodFactsByBarcode",
  "searchNaverShopping",
  "searchAlternativeCandidates",
  "judgeAlternativeFit",
  "recommendAlternativeProducts",
  "recommendAlternativeShoppingSearches",
  "verifyAlternativeShoppingResults",
  "recommendFoodPairings",
  "lookupI0490",
  "enrichProduct",
  "selectBestProductCandidate",
  "analyzeFoodImage",
  "translateProductToKorean",
  "lookupVerifiedProduct",
  "verifyAdminAccess",
  "listReviewQueue",
  "getAccountSnapshot",
]);
const inFlightRequests = new Map<string, Promise<unknown>>();

type EnvLike = Record<string, string | undefined>;

export interface AppEdgeFunctionConfig {
  url: string;
  apiKey?: string;
}

export interface AppEdgeFunctionRequestOptions {
  timeoutMs?: number;
}

export class AppEdgeFunctionError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AppEdgeFunctionError";
    this.status = status;
    this.code = code;
  }
}

const runtimeEnv = (): EnvLike => {
  const globalWithEnv = globalThis as typeof globalThis & {
    process?: { env?: EnvLike };
    __APP_ENV__?: EnvLike;
  };
  const meta = import.meta as ImportMeta & { env?: EnvLike };

  return {
    ...(globalWithEnv.process?.env ?? {}),
    ...(globalWithEnv.__APP_ENV__ ?? {}),
    ...(meta.env ?? {}),
  };
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const appendFunctionName = (baseUrl: string) => {
  const normalized = trimTrailingSlash(baseUrl);
  return normalized.endsWith(`/${APP_EDGE_FUNCTION_NAME}`)
    ? normalized
    : `${normalized}/${APP_EDGE_FUNCTION_NAME}`;
};

export function readAppEdgeFunctionConfig(
  env: EnvLike = runtimeEnv(),
): AppEdgeFunctionConfig | null {
  const explicitUrl =
    env.VITE_APP_EDGE_FUNCTION_URL ||
    env.VITE_SUPABASE_EDGE_FUNCTION_URL ||
    env.SUPABASE_EDGE_FUNCTION_URL;
  const functionsBaseUrl = env.VITE_SUPABASE_FUNCTIONS_URL || env.SUPABASE_FUNCTIONS_URL;
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const restUrl = env.VITE_SUPABASE_REST_URL || env.SUPABASE_REST_URL;
  const projectId =
    env.VITE_SUPABASE_PROJECT_ID || env.SUPABASE_PROJECT_ID || DEFAULT_SUPABASE_PROJECT_ID;
  const apiKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (explicitUrl) {
    return { url: trimTrailingSlash(explicitUrl), apiKey };
  }

  if (functionsBaseUrl) {
    return { url: appendFunctionName(functionsBaseUrl), apiKey };
  }

  if (supabaseUrl) {
    return {
      url: `${trimTrailingSlash(supabaseUrl)}/functions/v1/${APP_EDGE_FUNCTION_NAME}`,
      apiKey,
    };
  }

  if (restUrl) {
    const functionsUrl = trimTrailingSlash(restUrl).replace(/\/rest\/v1$/, "/functions/v1");
    return { url: appendFunctionName(functionsUrl), apiKey };
  }

  if (projectId) {
    return {
      url: `https://${projectId}.supabase.co/functions/v1/${APP_EDGE_FUNCTION_NAME}`,
      apiKey,
    };
  }

  return null;
}

const parseJson = (text: string): unknown => {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const errorMessageFromPayload = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
};

const requestCacheKey = (
  config: AppEdgeFunctionConfig,
  bodyText: string,
  options: AppEdgeFunctionRequestOptions,
) => [config.url, config.apiKey ?? "", String(options.timeoutMs ?? ""), bodyText].join("\n");

const executeAppEdgeFunctionRequest = async <T>(
  config: AppEdgeFunctionConfig,
  bodyText: string,
  options: AppEdgeFunctionRequestOptions,
): Promise<T> => {
  const controller =
    typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;
  let response: Response;
  let responseText: string;

  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { apikey: config.apiKey } : {}),
      },
      body: bodyText,
      ...(controller ? { signal: controller.signal } : {}),
    });
    responseText = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppEdgeFunctionError("Edge Function request timed out", 0, "REQUEST_TIMEOUT");
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  const responsePayload = parseJson(responseText);

  if (!response.ok) {
    const message = errorMessageFromPayload(
      responsePayload,
      response.statusText || "Request failed",
    );
    throw new AppEdgeFunctionError(message, response.status);
  }

  if (
    responsePayload &&
    typeof responsePayload === "object" &&
    !Array.isArray(responsePayload) &&
    "data" in responsePayload
  ) {
    return (responsePayload as { data: T }).data;
  }

  return responsePayload as T;
};

export async function callAppEdgeFunction<T>(
  action: string,
  payload: unknown = {},
  options: AppEdgeFunctionRequestOptions = {},
): Promise<T> {
  return callAppEdgeFunctionWithOptions<T>(action, payload, options);
}

export async function callAppEdgeFunctionWithOptions<T>(
  action: string,
  payload: unknown = {},
  options: AppEdgeFunctionRequestOptions = {},
): Promise<T> {
  const config = readAppEdgeFunctionConfig();
  if (!config) {
    throw new AppEdgeFunctionError("Supabase Edge Function URL is not configured", 0, "NO_CONFIG");
  }

  const bodyText = JSON.stringify({ action, payload });

  if (!DEDUPED_READ_ACTIONS.has(action)) {
    return executeAppEdgeFunctionRequest<T>(config, bodyText, options);
  }

  const cacheKey = requestCacheKey(config, bodyText, options);
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) return inFlight as Promise<T>;

  const request = executeAppEdgeFunctionRequest<T>(config, bodyText, options).finally(() => {
    inFlightRequests.delete(cacheKey);
  });
  inFlightRequests.set(cacheKey, request);
  return request;
}
