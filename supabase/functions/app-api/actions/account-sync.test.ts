import { describe, expect, it } from "vitest";
import {
  assertAccountPin,
  assertAccountUsername,
  assertLocalDataSnapshot,
  hashAccountPin,
  normalizeAccountUsername,
} from "./account-sync.ts";

describe("account sync validators", () => {
  it("normalizes and validates account IDs", () => {
    expect(normalizeAccountUsername(" Demo.User ")).toBe("demo.user");
    expect(assertAccountUsername(" Demo_User-1 ")).toBe("demo_user-1");
    expect(() => assertAccountUsername("ab")).toThrow("Account ID");
    expect(() => assertAccountUsername("bad space")).toThrow("Account ID");
  });

  it("requires numeric PINs", () => {
    expect(assertAccountPin(" 1234 ")).toBe("1234");
    expect(() => assertAccountPin("123")).toThrow("PIN");
    expect(() => assertAccountPin("abcd")).toThrow("PIN");
  });

  it("accepts only current local data snapshots", () => {
    const snapshot = {
      app: "food-scan",
      version: 1,
      exportedAt: "2026-05-16T00:00:00.000Z",
      data: { recent: [] },
    };

    expect(assertLocalDataSnapshot(snapshot)).toBe(snapshot);
    expect(() => assertLocalDataSnapshot({ ...snapshot, version: 2 })).toThrow("Unsupported");
    expect(() => assertLocalDataSnapshot({ ...snapshot, data: null })).toThrow("Invalid");
  });

  it("hashes PINs deterministically per salt", async () => {
    const first = await hashAccountPin("1234", "salt-a");
    const second = await hashAccountPin("1234", "salt-a");
    const differentSalt = await hashAccountPin("1234", "salt-b");

    expect(first).toBe(second);
    expect(first).not.toBe(differentSalt);
    expect(first).toHaveLength(64);
  });
});
