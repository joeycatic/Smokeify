import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorefrontOrigin } from "@/lib/storefrontEmailBrand";

vi.mock("server-only", () => ({}));

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;
const originalGrowUrl = process.env.NEXT_PUBLIC_GROW_APP_URL;

const restoreEnvVar = (key: string, value: string | undefined) => {
  if (typeof value === "undefined") {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

afterEach(() => {
  restoreEnvVar("NEXT_PUBLIC_APP_URL", originalAppUrl);
  restoreEnvVar("NEXTAUTH_URL", originalNextAuthUrl);
  restoreEnvVar("NEXT_PUBLIC_GROW_APP_URL", originalGrowUrl);
});

describe("getStorefrontOrigin", () => {
  it("keeps GrowVault email links on GrowVault when the admin origin is Smokeify", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.smokeify.de";
    process.env.NEXTAUTH_URL = "https://www.smokeify.de";
    delete process.env.NEXT_PUBLIC_GROW_APP_URL;

    expect(getStorefrontOrigin("GROW", "https://www.smokeify.de")).toBe(
      "https://www.growvault.de",
    );
  });

  it("uses a GrowVault fallback origin when one is provided", () => {
    delete process.env.NEXT_PUBLIC_GROW_APP_URL;

    expect(getStorefrontOrigin("GROW", "https://growvault.de/admin")).toBe(
      "https://growvault.de",
    );
  });
});
