import { HttpError, assertObject, requiredString } from "../_shared/runtime.ts";
import { requestSupabase } from "../_shared/supabase-rest.ts";
import type { JsonValue } from "../_shared/types.ts";

const ACCOUNT_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const ACCOUNT_PIN_PATTERN = /^[0-9]{4,12}$/;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PIN_HASH_ITERATIONS = 120_000;
const MAX_SNAPSHOT_BYTES = 200_000;
const LOCAL_DATA_EXPORT_APP = "food-scan";
const LOCAL_DATA_EXPORT_VERSION = 1;

const textEncoder = new TextEncoder();

export interface AccountSession {
  userId: string;
  username: string;
  displayName: string;
  token: string;
  expiresAt: string;
}

export interface AccountSignInResult {
  session: AccountSession;
  snapshot: LocalDataSnapshot | null;
  created: boolean;
}

interface AccountUserRow {
  id: string;
  username: string;
  display_name: string;
  pin_salt: string;
  pin_hash: string;
}

interface AccountSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
}

interface AccountDataRow {
  user_id: string;
  snapshot: LocalDataSnapshot;
  updated_at: string;
}

export interface LocalDataSnapshot {
  app: typeof LOCAL_DATA_EXPORT_APP;
  version: typeof LOCAL_DATA_EXPORT_VERSION;
  exportedAt: string;
  data: Record<string, unknown>;
}

const bytesToHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const randomHex = (byteLength: number) => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};

const sha256Hex = async (value: string) =>
  bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value))));

export const normalizeAccountUsername = (value: string) => value.trim().toLowerCase();

export const assertAccountUsername = (value: string) => {
  const username = normalizeAccountUsername(value);
  if (!ACCOUNT_USERNAME_PATTERN.test(username)) {
    throw new HttpError(
      "Account ID must be 3-32 lowercase letters, numbers, dot, dash, or underscore",
      400,
      "INVALID_ACCOUNT_ID",
    );
  }
  return username;
};

export const assertAccountPin = (value: string) => {
  const pin = value.trim();
  if (!ACCOUNT_PIN_PATTERN.test(pin)) {
    throw new HttpError("PIN must be 4-12 digits", 400, "INVALID_ACCOUNT_PIN");
  }
  return pin;
};

export const assertLocalDataSnapshot = (value: unknown): LocalDataSnapshot => {
  const snapshot = assertObject(value);
  if (snapshot.app !== LOCAL_DATA_EXPORT_APP || snapshot.version !== LOCAL_DATA_EXPORT_VERSION) {
    throw new HttpError("Unsupported account snapshot", 400, "UNSUPPORTED_ACCOUNT_SNAPSHOT");
  }
  if (typeof snapshot.exportedAt !== "string" || !assertObject(snapshot.data)) {
    throw new HttpError("Invalid account snapshot", 400, "INVALID_ACCOUNT_SNAPSHOT");
  }
  if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_BYTES) {
    throw new HttpError("Account snapshot is too large", 413, "ACCOUNT_SNAPSHOT_TOO_LARGE");
  }
  return snapshot as unknown as LocalDataSnapshot;
};

export const hashAccountPin = async (pin: string, salt: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: textEncoder.encode(salt),
      iterations: PIN_HASH_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
};

const requireRows = <T>(rows: T[] | null, code = "ACCOUNT_SYNC_UNAVAILABLE") => {
  if (!rows) {
    throw new HttpError("Account sync storage is not configured", 503, code);
  }
  return rows;
};

const findAccountUser = async (username: string) => {
  const rows = await requestSupabase<AccountUserRow[]>("app_users", {
    method: "GET",
    params: {
      select: "*",
      username: `eq.${username}`,
      limit: "1",
    },
  });
  return requireRows(rows)[0] ?? null;
};

const findAccountUserById = async (userId: string) => {
  const rows = await requestSupabase<AccountUserRow[]>("app_users", {
    method: "GET",
    params: {
      select: "*",
      id: `eq.${userId}`,
      limit: "1",
    },
  });
  return requireRows(rows)[0] ?? null;
};

const createAccountUser = async (username: string, pin: string) => {
  const salt = randomHex(16);
  const rows = await requestSupabase<AccountUserRow[]>("app_users", {
    method: "POST",
    body: JSON.stringify({
      username,
      display_name: username,
      pin_salt: salt,
      pin_hash: await hashAccountPin(pin, salt),
    }),
    prefer: "return=representation",
  });
  const user = requireRows(rows)[0];
  if (!user) throw new HttpError("Account could not be created", 500, "ACCOUNT_CREATE_FAILED");
  return user;
};

const getAccountSnapshot = async (userId: string) => {
  const rows = await requestSupabase<AccountDataRow[]>("app_user_data", {
    method: "GET",
    params: {
      select: "user_id,snapshot,updated_at",
      user_id: `eq.${userId}`,
      limit: "1",
    },
  });
  return requireRows(rows)[0]?.snapshot ?? null;
};

const createAccountSession = async (user: AccountUserRow): Promise<AccountSession> => {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const rows = await requestSupabase<AccountSessionRow[]>("app_user_sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id,
      token_hash: await sha256Hex(token),
      expires_at: expiresAt,
    }),
    prefer: "return=representation",
  });
  requireRows(rows);
  return {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    token,
    expiresAt,
  };
};

const verifyAccountSession = async (token: string, expectedUserId?: string) => {
  const tokenHash = await sha256Hex(token);
  const sessionRows = await requestSupabase<AccountSessionRow[]>("app_user_sessions", {
    method: "GET",
    params: {
      select: "*",
      token_hash: `eq.${tokenHash}`,
      limit: "1",
    },
  });
  const session = requireRows(sessionRows)[0];
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new HttpError("Account session is invalid or expired", 401, "ACCOUNT_SESSION_INVALID");
  }
  if (expectedUserId && session.user_id !== expectedUserId) {
    throw new HttpError("Account session does not match user", 401, "ACCOUNT_SESSION_MISMATCH");
  }

  const user = await findAccountUserById(session.user_id);
  if (!user) throw new HttpError("Account not found", 404, "ACCOUNT_NOT_FOUND");
  return user;
};

export const signInAccountInternal = async (
  usernameInput: string,
  pinInput: string,
): Promise<AccountSignInResult> => {
  const username = assertAccountUsername(usernameInput);
  const pin = assertAccountPin(pinInput);
  const existingUser = await findAccountUser(username);
  const user = existingUser ?? (await createAccountUser(username, pin));

  if (existingUser) {
    const pinHash = await hashAccountPin(pin, existingUser.pin_salt);
    if (pinHash !== existingUser.pin_hash) {
      throw new HttpError("Invalid account ID or PIN", 401, "ACCOUNT_LOGIN_FAILED");
    }
  }

  return {
    session: await createAccountSession(user),
    snapshot: await getAccountSnapshot(user.id),
    created: !existingUser,
  };
};

export const getAccountSnapshotInternal = async (
  tokenInput: string,
  userIdInput?: string,
): Promise<LocalDataSnapshot | null> => {
  const user = await verifyAccountSession(requiredString({ token: tokenInput }, "token"), userIdInput);
  return getAccountSnapshot(user.id);
};

export const syncAccountSnapshotInternal = async (
  tokenInput: string,
  snapshotInput: unknown,
  userIdInput?: string,
): Promise<boolean> => {
  const user = await verifyAccountSession(requiredString({ token: tokenInput }, "token"), userIdInput);
  const snapshot = assertLocalDataSnapshot(snapshotInput);
  const rows = await requestSupabase<AccountDataRow[]>("app_user_data", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id,
      snapshot: snapshot as unknown as JsonValue,
    }),
    prefer: "resolution=merge-duplicates,return=representation",
  });
  return requireRows(rows).length > 0;
};

export const signOutAccountInternal = async (tokenInput: string): Promise<boolean> => {
  const token = requiredString({ token: tokenInput }, "token");
  await requestSupabase<null>("app_user_sessions", {
    method: "DELETE",
    params: {
      token_hash: `eq.${await sha256Hex(token)}`,
    },
  });
  return true;
};
