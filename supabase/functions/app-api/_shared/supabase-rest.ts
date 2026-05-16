import { env, trimTrailingSlash } from "./runtime.ts";
import type { SupabaseRestConfig } from "./types.ts";

export const readSupabaseConfig = (): SupabaseRestConfig | null => {
  const currentEnv = env();
  const supabaseUrl = currentEnv.SUPABASE_URL || currentEnv.VITE_SUPABASE_URL;
  const restUrl =
    currentEnv.SUPABASE_REST_URL ||
    currentEnv.VITE_SUPABASE_REST_URL ||
    (supabaseUrl ? `${trimTrailingSlash(supabaseUrl)}/rest/v1` : undefined);
  const apiKey =
    currentEnv.SUPABASE_SERVICE_ROLE_KEY ||
    currentEnv.SUPABASE_ANON_KEY ||
    currentEnv.VITE_SUPABASE_ANON_KEY;

  if (!restUrl || !apiKey) return null;
  return { restUrl: trimTrailingSlash(restUrl), apiKey };
};

export const buildSupabaseRestUrl = (
  config: SupabaseRestConfig,
  table: string,
  params: Record<string, string> = {},
) => {
  const url = new URL(`${config.restUrl}/${table}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

export const buildSupabaseHeaders = (config: SupabaseRestConfig, prefer?: string) => ({
  apikey: config.apiKey,
  Authorization: `Bearer ${config.apiKey}`,
  "Content-Type": "application/json",
  ...(prefer ? { Prefer: prefer } : {}),
});

export const requestSupabase = async <T>(
  table: string,
  init: RequestInit & { params?: Record<string, string>; prefer?: string } = {},
): Promise<T | null> => {
  const config = readSupabaseConfig();
  if (!config) return null;

  const response = await fetch(buildSupabaseRestUrl(config, table, init.params), {
    ...init,
    headers: {
      ...buildSupabaseHeaders(config, init.prefer),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    console.error(`Supabase ${table} request failed`, response.status, await response.text());
    return null;
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
};
