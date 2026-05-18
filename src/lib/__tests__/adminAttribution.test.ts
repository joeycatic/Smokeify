import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deriveOrderAttributionCandidate } from "@/lib/adminAttribution";

describe("deriveOrderAttributionCandidate", () => {
  it("prefers explicit metadata storefront", () => {
    const candidate = deriveOrderAttributionCandidate({
      sourceStorefront: null,
      sourceOrigin: "https://growvault.de/products/test",
      sourceHost: "www.growvault.de",
      metadataSourceStorefront: "MAIN",
      historyStorefronts: ["GROW"],
    });

    expect(candidate).toMatchObject({
      storefront: "MAIN",
      sourceType: "metadata",
      exact: true,
    });
  });

  it("uses exact host before customer history", () => {
    const candidate = deriveOrderAttributionCandidate({
      sourceStorefront: null,
      sourceOrigin: null,
      sourceHost: "www.growvault.de",
      historyStorefronts: ["MAIN"],
    });

    expect(candidate).toMatchObject({
      storefront: "GROW",
      sourceType: "host",
      exact: true,
    });
  });

  it("keeps ambiguous history unresolved", () => {
    const candidate = deriveOrderAttributionCandidate({
      sourceStorefront: null,
      sourceOrigin: null,
      sourceHost: null,
      historyStorefronts: ["MAIN", "GROW"],
    });

    expect(candidate).toMatchObject({
      storefront: null,
      sourceType: "ambiguous",
      exact: false,
    });
  });
});
