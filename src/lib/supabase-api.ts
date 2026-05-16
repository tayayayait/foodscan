import { callAppEdgeFunction } from "./edge-function-client";
import type { ReviewQueueItem, ReviewQueueListStatus, ReviewStatus } from "./review-queue";
import type { ReviewReason } from "./supabase-mappers";
import type { Product } from "./types";

export interface SupabaseRestConfig {
  restUrl: string;
  apiKey: string;
  hasServiceRole: boolean;
}

type EnvLike = Record<string, string | undefined>;

function runtimeEnv(): EnvLike {
  const globalWithEnv = globalThis as typeof globalThis & {
    __APP_ENV__?: EnvLike;
    process?: { env?: EnvLike };
  };
  return {
    ...(globalWithEnv.process?.env ?? {}),
    ...(globalWithEnv.__APP_ENV__ ?? {}),
  };
}

export function readSupabaseConfig(env: EnvLike = runtimeEnv()): SupabaseRestConfig | null {
  const restUrl = env.SUPABASE_REST_URL || env.VITE_SUPABASE_REST_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const apiKey = serviceRoleKey || anonKey;

  if (!restUrl || !apiKey) return null;

  return {
    restUrl: restUrl.replace(/\/+$/, ""),
    apiKey,
    hasServiceRole: Boolean(serviceRoleKey),
  };
}

export function buildSupabaseRestUrl(
  config: SupabaseRestConfig,
  table: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${config.restUrl}/${table}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function buildSupabaseHeaders(config: SupabaseRestConfig, prefer?: string) {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export const lookupVerifiedProduct = (idOrBarcode: string) =>
  callAppEdgeFunction<Product | null>("lookupVerifiedProduct", { idOrBarcode });

export const upsertProductToSupabase = (product: Product) =>
  callAppEdgeFunction<boolean>("upsertProduct", { product });

export const enqueueProductReview = (
  product: Product,
  reason: ReviewReason,
  rawPayload: unknown = null,
) => callAppEdgeFunction<boolean>("enqueueReview", { product, reason, rawPayload });

export const enqueueUnknownAdditiveReview = (additiveName: string, productId?: string) =>
  callAppEdgeFunction<boolean>("enqueueAdditiveReview", { additiveName, productId });

export const listReviewQueue = (adminCode: string, status: ReviewQueueListStatus = "pending") =>
  callAppEdgeFunction<ReviewQueueItem[]>("listReviewQueue", { status, adminCode });

export const updateReviewStatus = (
  id: string,
  status: ReviewStatus,
  adminCode: string,
  note?: string,
) => callAppEdgeFunction<boolean>("updateReviewStatus", { id, status, adminCode, note });

export const approveReviewItem = (id: string, product: Product, adminCode: string) =>
  callAppEdgeFunction<boolean>("approveReviewItem", { id, product, adminCode });

export const verifyAdminAccess = (adminCode: string) =>
  callAppEdgeFunction<boolean>("verifyAdminAccess", { adminCode });
