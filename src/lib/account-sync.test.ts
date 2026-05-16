import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredAccountSession,
  getStoredAccountSession,
  isValidAccountPin,
  isValidAccountUsername,
  normalizeAccountUsername,
  storeAccountSession,
} from "./account-sync";

const installLocalStorage = () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("account sync client helpers", () => {
  it("validates account credentials before calling the Edge Function", () => {
    expect(normalizeAccountUsername(" Demo_User ")).toBe("demo_user");
    expect(isValidAccountUsername("demo-user_1")).toBe(true);
    expect(isValidAccountUsername("no")).toBe(false);
    expect(isValidAccountUsername("bad space")).toBe(false);
    expect(isValidAccountPin("1234")).toBe(true);
    expect(isValidAccountPin("12a4")).toBe(false);
  });

  it("stores and clears an unexpired account session", () => {
    installLocalStorage();
    const session = {
      userId: "user-1",
      username: "demo",
      displayName: "demo",
      token: "token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    storeAccountSession(session);
    expect(getStoredAccountSession()).toEqual(session);
    clearStoredAccountSession();
    expect(getStoredAccountSession()).toBeNull();
  });

  it("drops expired account sessions", () => {
    installLocalStorage();
    storeAccountSession({
      userId: "user-1",
      username: "demo",
      displayName: "demo",
      token: "token",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(getStoredAccountSession()).toBeNull();
  });
});
