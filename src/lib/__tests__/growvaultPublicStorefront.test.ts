import { describe, expect, it, vi } from "vitest";
import {
  GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE,
  GROWVAULT_ANALYZER_PATH,
  GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE,
  GROWVAULT_CUSTOMIZER_PATH,
  GROWVAULT_PUBLIC_URL,
  buildGrowvaultAnalyzerUrl,
  buildGrowvaultCustomizerUrl,
  buildGrowvaultPublicUrl,
} from "@/lib/growvaultPublicStorefront";

vi.mock("server-only", () => ({}));

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
});
