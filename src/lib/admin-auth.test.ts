import { describe, expect, it } from "vitest";
import { isAdminAccessGranted, readAdminAccessConfig } from "./admin-auth";

describe("admin auth helpers", () => {
  it("reads the configured admin access code", () => {
    expect(readAdminAccessConfig({ ADMIN_ACCESS_CODE: "secret" })).toEqual({
      enabled: true,
      accessCode: "secret",
    });
  });

  it("rejects missing configuration or wrong codes", () => {
    expect(isAdminAccessGranted("secret", {})).toBe(false);
    expect(isAdminAccessGranted("wrong", { ADMIN_ACCESS_CODE: "secret" })).toBe(false);
  });

  it("accepts the exact configured code after trimming user input", () => {
    expect(isAdminAccessGranted(" secret ", { ADMIN_ACCESS_CODE: "secret" })).toBe(true);
  });
});
