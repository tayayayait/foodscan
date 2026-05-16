import {
  AppEdgeFunctionError,
  callAppEdgeFunction,
  callAppEdgeFunctionWithOptions,
} from "./edge-function-client";
import type { LocalDataExport } from "./local-data-portability";

const ACCOUNT_SESSION_KEY = "kfs:account-session";
const ACCOUNT_SYNC_DEBOUNCE_MS = 500;

const hasLocalStorage = () => typeof globalThis.localStorage !== "undefined";
let pendingSnapshot: LocalDataExport | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

export interface AccountSession {
  userId: string;
  username: string;
  displayName: string;
  token: string;
  expiresAt: string;
}

export interface AccountSignInResult {
  session: AccountSession;
  snapshot: LocalDataExport | null;
  created: boolean;
}

export const normalizeAccountUsername = (value: string) => value.trim().toLowerCase();

export const isValidAccountUsername = (value: string) =>
  /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeAccountUsername(value));

export const isValidAccountPin = (value: string) => /^[0-9]{4,12}$/.test(value.trim());

function isAccountSession(value: unknown): value is AccountSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.userId === "string" &&
    typeof session.username === "string" &&
    typeof session.displayName === "string" &&
    typeof session.token === "string" &&
    typeof session.expiresAt === "string" &&
    new Date(session.expiresAt).getTime() > Date.now()
  );
}

export function getStoredAccountSession(): AccountSession | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(ACCOUNT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isAccountSession(parsed)) {
      localStorage.removeItem(ACCOUNT_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeAccountSession(session: AccountSession) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredAccountSession() {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(ACCOUNT_SESSION_KEY);
}

const sessionPayload = (session: AccountSession) => ({
  token: session.token,
  userId: session.userId,
});

export async function signInOrCreateAccount(
  username: string,
  pin: string,
): Promise<AccountSignInResult> {
  const result = await callAppEdgeFunction<AccountSignInResult>(
    "signInAccount",
    {
      username: normalizeAccountUsername(username),
      pin,
    },
    { timeoutMs: 10_000 },
  );
  storeAccountSession(result.session);
  return result;
}

export async function fetchAccountSnapshot(
  session: AccountSession,
): Promise<LocalDataExport | null> {
  return callAppEdgeFunctionWithOptions<LocalDataExport | null>(
    "getAccountSnapshot",
    sessionPayload(session),
    { timeoutMs: 10_000 },
  );
}

export async function syncAccountSnapshot(
  session: AccountSession,
  snapshot: LocalDataExport,
): Promise<boolean> {
  return callAppEdgeFunction<boolean>(
    "syncAccountSnapshot",
    {
      ...sessionPayload(session),
      snapshot,
    },
    { timeoutMs: 10_000 },
  );
}

export async function signOutAccount(session: AccountSession): Promise<boolean> {
  try {
    return await callAppEdgeFunction<boolean>("signOutAccount", sessionPayload(session), {
      timeoutMs: 8_000,
    });
  } finally {
    clearStoredAccountSession();
  }
}

export function accountSyncErrorMessage(error: unknown) {
  if (error instanceof AppEdgeFunctionError) {
    if (error.code === "ACCOUNT_LOGIN_FAILED") return "계정 ID 또는 PIN이 맞지 않습니다.";
    if (error.code === "INVALID_ACCOUNT_ID") {
      return "계정 ID는 영문 소문자, 숫자, 점, 대시, 밑줄 3-32자여야 합니다.";
    }
    if (error.code === "INVALID_ACCOUNT_PIN") return "PIN은 숫자 4-12자리여야 합니다.";
    if (error.status === 503) return "계정 동기화 저장소가 설정되지 않았습니다.";
    if (error.status === 401) return "계정 세션이 만료되었습니다. 다시 로그인하세요.";
    return error.message;
  }
  return error instanceof Error ? error.message : "계정 동기화에 실패했습니다.";
}

export function queueAccountSnapshotSync(snapshot: LocalDataExport) {
  const session = getStoredAccountSession();
  if (!session) return;

  pendingSnapshot = snapshot;
  if (pendingTimer) clearTimeout(pendingTimer);

  pendingTimer = setTimeout(() => {
    const nextSnapshot = pendingSnapshot;
    const nextSession = getStoredAccountSession();
    pendingSnapshot = null;
    pendingTimer = null;
    if (!nextSnapshot || !nextSession) return;

    void syncAccountSnapshot(nextSession, nextSnapshot).catch((error) => {
      if (error instanceof AppEdgeFunctionError && error.status === 401) {
        clearStoredAccountSession();
      }
      console.warn("Account snapshot sync failed", error);
    });
  }, ACCOUNT_SYNC_DEBOUNCE_MS);
}
