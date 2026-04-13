import { afterEach, describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/requestSecurity";

const originalMainUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;
const originalGrowUrl = process.env.NEXT_PUBLIC_GROW_APP_URL;
const originalMainHosts = process.env.MAIN_STOREFRONT_HOSTS;
const originalGrowHosts = process.env.GROW_STOREFRONT_HOSTS;

const restoreEnvVar = (key: string, value: string | undefined) => {
  if (typeof value === "undefined") {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

afterEach(() => {
  restoreEnvVar("NEXT_PUBLIC_APP_URL", originalMainUrl);
  restoreEnvVar("NEXTAUTH_URL", originalNextAuthUrl);
  restoreEnvVar("NEXT_PUBLIC_GROW_APP_URL", originalGrowUrl);
  restoreEnvVar("MAIN_STOREFRONT_HOSTS", originalMainHosts);
  restoreEnvVar("GROW_STOREFRONT_HOSTS", originalGrowHosts);
});

describe("requestSecurity", () => {
  it("accepts grow storefront origins for unsafe requests", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.de";

    const request = new Request("https://www.smokeify.de/api/checkout", {
      method: "POST",
      headers: {
        origin: "https://growvault.de",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts configured grow alias hosts from referer", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.de";
    process.env.GROW_STOREFRONT_HOSTS = "www.growvault.de";

    const request = new Request("https://www.smokeify.de/api/checkout", {
      method: "POST",
      headers: {
        referer: "https://www.growvault.de/cart",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts localhost requests when origin matches the request host", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    delete process.env.MAIN_STOREFRONT_HOSTS;
    delete process.env.GROW_STOREFRONT_HOSTS;

    const request = new Request("http://127.0.0.1:3900/api/admin/orders/test/email", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3900",
      },
    });

    expect(isSameOrigin(request)).toBe(true);
  });
});
