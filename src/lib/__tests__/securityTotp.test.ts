import { describe, expect, it } from "vitest";
import { normalizeTotpCode, resolveTotpWindowSteps, verifyTotpCode } from "@/lib/security";

describe("normalizeTotpCode", () => {
  it("keeps only digits and limits to six characters", () => {
    expect(normalizeTotpCode(" 12a-34 56 78 ")).toBe("123456");
  });
});

describe("resolveTotpWindowSteps", () => {
  it("falls back to the default window for invalid values", () => {
    process.env.ADMIN_TOTP_WINDOW_STEPS = "invalid";
    expect(resolveTotpWindowSteps()).toBe(1);
  });

  it("uses a valid configured window", () => {
    process.env.ADMIN_TOTP_WINDOW_STEPS = "3";
    expect(resolveTotpWindowSteps()).toBe(3);
    delete process.env.ADMIN_TOTP_WINDOW_STEPS;
  });
});

describe("verifyTotpCode", () => {
  it("accepts a code within an explicitly widened drift window", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const baseNow = 1_700_000_000_000;
    const driftedNow = baseNow + 60_000;
    const validAtBaseTime = "324550";

    expect(verifyTotpCode(secret, validAtBaseTime, driftedNow, 1)).toBe(false);
    expect(verifyTotpCode(secret, validAtBaseTime, driftedNow, 2)).toBe(true);
  });
});
