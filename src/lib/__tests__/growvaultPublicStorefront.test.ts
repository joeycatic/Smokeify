import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE,
  GROWVAULT_ANALYZER_PATH,
  GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE,
  GROWVAULT_CUSTOMIZER_PATH,
  GROWVAULT_PUBLIC_URL,
  buildGrowvaultAnalyzerUrl,
  buildGrowvaultCustomizerUrl,
  buildGrowvaultPublicUrl,
  serializeForwardedSearchParams,
} from "@/lib/growvaultPublicStorefront";

vi.mock("server-only", () => ({}));

const ORIGINAL_NEXT_PUBLIC_GROWVAULT_APP_URL =
  process.env.NEXT_PUBLIC_GROWVAULT_APP_URL;
const ORIGINAL_GROWVAULT_APP_URL = process.env.GROWVAULT_APP_URL;
const ORIGINAL_NEXT_PUBLIC_GROW_APP_URL = process.env.NEXT_PUBLIC_GROW_APP_URL;
const ORIGINAL_GROW_APP_URL = process.env.GROW_APP_URL;

async function loadGrowvaultPublicStorefrontModule() {
  vi.resetModules();
  return import("@/lib/growvaultPublicStorefront");
}

afterEach(() => {
  vi.resetModules();

  if (typeof ORIGINAL_NEXT_PUBLIC_GROWVAULT_APP_URL === "string") {
    process.env.NEXT_PUBLIC_GROWVAULT_APP_URL =
      ORIGINAL_NEXT_PUBLIC_GROWVAULT_APP_URL;
  } else {
    delete process.env.NEXT_PUBLIC_GROWVAULT_APP_URL;
  }

  if (typeof ORIGINAL_GROWVAULT_APP_URL === "string") {
    process.env.GROWVAULT_APP_URL = ORIGINAL_GROWVAULT_APP_URL;
  } else {
    delete process.env.GROWVAULT_APP_URL;
  }

  if (typeof ORIGINAL_NEXT_PUBLIC_GROW_APP_URL === "string") {
    process.env.NEXT_PUBLIC_GROW_APP_URL = ORIGINAL_NEXT_PUBLIC_GROW_APP_URL;
  } else {
    delete process.env.NEXT_PUBLIC_GROW_APP_URL;
  }

  if (typeof ORIGINAL_GROW_APP_URL === "string") {
    process.env.GROW_APP_URL = ORIGINAL_GROW_APP_URL;
  } else {
    delete process.env.GROW_APP_URL;
  }
});

describe("growvaultPublicStorefront", () => {
  it("keeps the canonical growvault analyzer path stable", () => {
    expect(GROWVAULT_PUBLIC_URL).toBe("https://www.growvault.de");
    expect(GROWVAULT_ANALYZER_PATH).toBe("/pflanzen-analyse");
    expect(GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE).toBe("2026-06-15");
    expect(GROWVAULT_CUSTOMIZER_PATH).toBe("/customizer");
    expect(GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE).toBe("2026-06-15");
  });

  it("builds absolute growvault storefront urls", () => {
    expect(buildGrowvaultPublicUrl("/customizer")).toBe(
      "https://www.growvault.de/customizer",
    );
    expect(buildGrowvaultPublicUrl("/pflanzen-analyse", "from=smokeify")).toBe(
      "https://www.growvault.de/pflanzen-analyse?from=smokeify",
    );
  });

  it("builds the canonical growvault analyzer url", () => {
    expect(buildGrowvaultAnalyzerUrl()).toBe(
      "https://www.growvault.de/pflanzen-analyse",
    );
  });

  it("builds the canonical growvault customizer url", () => {
    expect(buildGrowvaultCustomizerUrl()).toBe(
      "https://www.growvault.de/customizer",
    );
  });

  it("preserves repeated query values for GrowVault-owned route handoffs", () => {
    expect(
      serializeForwardedSearchParams({
        preset: "compact",
        product: ["one", "two"],
        empty: undefined,
      }),
    ).toBe("preset=compact&product=one&product=two");
  });

  it("accepts the legacy grow app env alias for the analyzer bridge target", async () => {
    delete process.env.NEXT_PUBLIC_GROWVAULT_APP_URL;
    delete process.env.GROWVAULT_APP_URL;
    process.env.NEXT_PUBLIC_GROW_APP_URL = "http://127.0.0.1:3000";

    const storefrontModule = await loadGrowvaultPublicStorefrontModule();

    expect(storefrontModule.GROWVAULT_PUBLIC_URL).toBe("http://127.0.0.1:3000");
    expect(storefrontModule.buildGrowvaultAnalyzerUrl()).toBe(
      "http://127.0.0.1:3000/pflanzen-analyse",
    );
  });
});
