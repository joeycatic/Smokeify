import { describe, expect, it } from "vitest";
import {
  buildProductSearchTermGroups,
  getProductSearchScore,
  matchesProductSearch,
  normalizeProductSearchText,
} from "@/lib/productSearch";

describe("normalizeProductSearchText", () => {
  it("normalizes umlauts and punctuation into stable search text", () => {
    expect(normalizeProductSearchText("Prima Klima EC-TC Lüfter")).toBe(
      "prima klima ec tc luefter",
    );
  });
});
describe("matchesProductSearch", () => {
  it("matches hyphenated model names when the query is spaced", () => {
    expect(
      matchesProductSearch(
        {
          title: "Prima Klima EC-TC Ventilator",
          handle: "prima-klima-ec-tc-125",
        },
        "prima klima ec tc",
      ),
    ).toBe(true);
  });

  it("matches growbox synonyms and compact dimensions", () => {
    expect(
      matchesProductSearch(
        {
          title: "HOMEbox Ambient Q120+",
          categories: ["Pflanzenzelt", "Zelte"],
          extra: ["120 x 120 cm"],
        },
        "growbox 120x120",
      ),
    ).toBe(true);
  });

  it("does not match when only part of a multi-term query is present", () => {
    expect(
      matchesProductSearch(
        {
          title: "Prima Klima Ventilator",
          description: "Leiser Rohrventilator fuer dein Setup",
        },
        "prima klima carbon filter",
      ),
    ).toBe(false);
  });

  it("matches common german search typos through synonym expansion", () => {
    expect(
      matchesProductSearch(
        {
          title: "Prima Klima Lüfter",
          categories: ["Abluft"],
        },
        "prima klima lufter",
      ),
    ).toBe(true);
  });

  it("matches admin-defined synonym groups in addition to defaults", () => {
    expect(
      matchesProductSearch(
        {
          title: "Prima Klima Rohrventilator",
          categories: ["Luft"],
        },
        "extractor",
        { synonyms: { extractor: ["rohrventilator", "inline fan"] } },
      ),
    ).toBe(true);
  });

  it("normalizes commercial aliases and exact short product terms", () => {
    expect(
      matchesProductSearch(
        {
          title: "BioBizz Bio-Bloom 250 ml",
          manufacturer: "Biobizz",
        },
        "bio bizz",
      ),
    ).toBe(true);
    expect(
      matchesProductSearch(
        {
          title: "Hydroponic Research VBX Clean 450g",
          manufacturer: "Hydroponic Research",
        },
        "vbx",
      ),
    ).toBe(true);
    expect(
      matchesProductSearch(
        {
          title: "BIO pH- down 250ml",
          categories: ["Messgeräte"],
        },
        "pH",
      ),
    ).toBe(true);
  });

  it("keeps single-character exploratory queries usable", () => {
    expect(
      matchesProductSearch(
        {
          title: "BioBizz Bio-Grow 250 ml",
          manufacturer: "Biobizz",
        },
        "B",
      ),
    ).toBe(true);
  });

  it("understands natural German product requests without matching filler words", () => {
    expect(
      matchesProductSearch(
        {
          title: "LED Growlampe für 80 x 80 cm",
          categories: ["Beleuchtung"],
          extra: ["growbox 80 x 80 cm"],
        },
        "Ich suche eine LED für eine 80 × 80 Box",
      ),
    ).toBe(true);
  });
});

describe("buildProductSearchTermGroups", () => {
  it("keeps buying signals while removing common conversational filler", () => {
    const groups = buildProductSearchTermGroups(
      "Ich suche bitte eine leise Abluft für mein Zelt",
    );

    expect(groups).toHaveLength(3);
    expect(groups[0]).toContain("leise");
    expect(groups[1]).toContain("abluft");
    expect(groups[2]).toContain("zelt");
  });

  it("normalizes spaced multiplication signs in setup dimensions", () => {
    const groups = buildProductSearchTermGroups("LED für 80 × 80 cm");

    expect(groups.some((group) => group.includes("80x80"))).toBe(true);
  });
});

describe("getProductSearchScore", () => {
  it("scores title matches above description-only matches", () => {
    const exactTitleScore = getProductSearchScore(
      {
        title: "Prima Klima EC TC",
        handle: "prima-klima-ec-tc",
      },
      "prima klima ec tc",
    );
    const descriptionOnlyScore = getProductSearchScore(
      {
        title: "Silent Fan",
        description: "Compatible with Prima Klima EC TC controllers.",
      },
      "prima klima ec tc",
    );

    expect(exactTitleScore).toBeGreaterThan(descriptionOnlyScore);
  });
});
