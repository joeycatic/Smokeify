import { afterEach, describe, expect, it } from "vitest";
import {
  formatOrderSourceLabel,
  resolveOrderSourceFromMetadata,
  resolveOrderSourceFromRequest,
} from "@/lib/orderSource";

const originalMainUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;
const originalGrowUrl = process.env.NEXT_PUBLIC_GROW_APP_URL;
const originalMainHosts = process.env.MAIN_STOREFRONT_HOSTS;
const originalGrowHosts = process.env.GROW_STOREFRONT_HOSTS;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalMainUrl;
  process.env.NEXTAUTH_URL = originalNextAuthUrl;
  process.env.NEXT_PUBLIC_GROW_APP_URL = originalGrowUrl;
  process.env.MAIN_STOREFRONT_HOSTS = originalMainHosts;
  process.env.GROW_STOREFRONT_HOSTS = originalGrowHosts;
});

describe("orderSource", () => {
  it("falls back to request.url when host headers are absent", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.eu";
    process.env.MAIN_STOREFRONT_HOSTS = "";
    process.env.GROW_STOREFRONT_HOSTS = "";

    const request = new Request("https://growvault.eu/api/checkout", {
      method: "POST",
    });

    expect(resolveOrderSourceFromRequest(request)).toEqual({
      sourceStorefront: "GROW",
      sourceHost: "growvault.eu",
      sourceOrigin: "https://growvault.eu",
    });
  });

  it("still prefers forwarded host headers when present", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.eu";

    const request = new Request("https://internal.vercel.app/api/checkout", {
      method: "POST",
      headers: {
        "x-forwarded-host": "smokeify.de",
        "x-forwarded-proto": "https",
      },
    });

    expect(resolveOrderSourceFromRequest(request)).toEqual({
      sourceStorefront: "MAIN",
      sourceHost: "smokeify.de",
      sourceOrigin: "https://smokeify.de",
    });
  });

  it("falls back to the origin header when the request host is internal", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.eu";

    const request = new Request("https://internal.vercel.app/api/checkout", {
      method: "POST",
      headers: {
        origin: "https://growvault.eu",
      },
    });

    expect(resolveOrderSourceFromRequest(request)).toEqual({
      sourceStorefront: "GROW",
      sourceHost: "growvault.eu",
      sourceOrigin: "https://growvault.eu",
    });
  });

  it("derives sourceHost from metadata.sourceOrigin when metadata.sourceHost is missing", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://smokeify.de";
    process.env.NEXTAUTH_URL = "https://smokeify.de";
    process.env.NEXT_PUBLIC_GROW_APP_URL = "https://growvault.eu";

    expect(
      resolveOrderSourceFromMetadata({
        sourceOrigin: "https://growvault.eu/checkout",
      }),
    ).toEqual({
      sourceStorefront: "GROW",
      sourceHost: "growvault.eu",
      sourceOrigin: "https://growvault.eu",
    });
  });

  it("formats the source label from sourceOrigin when sourceHost is unavailable", () => {
    expect(formatOrderSourceLabel(null, null, "https://growvault.eu/cart")).toBe(
      "growvault.eu",
    );
  });
});
