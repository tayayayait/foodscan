type EnvLike = Record<string, string | undefined>;

export interface AdminAccessConfig {
  enabled: boolean;
  accessCode: string | null;
}

export function readAdminAccessConfig(env: EnvLike): AdminAccessConfig {
  const accessCode = env.ADMIN_ACCESS_CODE?.trim();
  return {
    enabled: Boolean(accessCode),
    accessCode: accessCode || null,
  };
}

export function isAdminAccessGranted(inputCode: string | undefined, env: EnvLike): boolean {
  const config = readAdminAccessConfig(env);
  if (!config.enabled || !config.accessCode) return false;
  return inputCode?.trim() === config.accessCode;
}
