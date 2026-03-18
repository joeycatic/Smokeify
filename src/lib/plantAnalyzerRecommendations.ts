import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { blogPosts } from "@/lib/blog";
import type { PlantAnalyzerIssue } from "@/lib/plantAnalyzer";

export type PlantAnalyzerProductSuggestion = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string;
  price: { amount: string; currencyCode: "EUR" } | null;
  reason: string;
};

export type PlantAnalyzerGuideSuggestion = {
  slug: string;
  title: string;
  description: string;
  href: string;
};

type ProductSuggestionRecord = Prisma.ProductGetPayload<{
  include: {
    images: { orderBy: { position: "asc" }; take: 1 };
    variants: {
      orderBy: { position: "asc" };
      select: { priceCents: true };
    };
  };
}>;

const CURRENCY_CODE = "EUR";
const toAmount = (cents: number) => (cents / 100).toFixed(2);

type IssueProductProfile = {
  reason: string;
  categoryHandles?: string[];
  titleTerms?: string[];
  handleTerms?: string[];
  manufacturers?: string[];
  excludeTitleTerms?: string[];
  excludeHandleTerms?: string[];
  skip?: boolean;
};

const GLOBAL_EXCLUDED_CATEGORY_HANDLES = ["headshop"];

type ProductSearchProfile = {
  reason: string;
  categoryHandles?: string[];
  titleTerms?: string[];
  handleTerms?: string[];
  manufacturers?: string[];
  excludeTitleTerms?: string[];
  excludeHandleTerms?: string[];
};

function getIssueProductProfile(issue: PlantAnalyzerIssue): IssueProductProfile {
  const value = issue.label.toLowerCase();

  if (value.includes("calcium") || value.includes("magnes")) {
    return {
      reason: "Passend bei Verdacht auf Calcium- oder Magnesiummangel.",
      categoryHandles: ["duenger"],
      titleTerms: ["calmag"],
      handleTerms: ["calmag"],
      manufacturers: ["BioBizz"],
    };
  }

  if (value.includes("ph")) {
    return {
      reason: "Passend zur Korrektur eines instabilen pH-Werts.",
      categoryHandles: ["ph-regulatoren"],
      titleTerms: ["ph+", "ph-", "ph up", "ph down"],
      handleTerms: ["ph-up", "ph-down"],
      manufacturers: ["BioBizz"],
    };
  }

  if (value.includes("nährstoffverbrennung")) {
    return {
      reason: "Bei Nährstoffverbrennung ist eher Zurückhaltung als zusätzliches Produkt sinnvoll.",
      skip: true,
    };
  }

  if (value.includes("stickstoff")) {
    return {
      reason: "Passend zur vorsichtigen Basisdüngung bei Stickstoffmangel.",
      categoryHandles: ["duenger"],
      titleTerms: ["bio-grow", "fishmix", "starter pack"],
      handleTerms: ["bio-grow", "fishmix", "try-pack"],
      manufacturers: ["BioBizz"],
      excludeTitleTerms: ["topmax", "bio-bloom"],
    };
  }

  if (value.includes("kali")) {
    return {
      reason: "Passend bei Verdacht auf Kalium- bzw. Blütedüngungsprobleme.",
      categoryHandles: ["duenger"],
      titleTerms: ["bio-bloom"],
      handleTerms: ["bio-bloom"],
      manufacturers: ["BioBizz"],
    };
  }

  if (value.includes("nährstoff")) {
    return {
      reason: "Passend zur Basisversorgung oder zum schonenden Wiedereinstieg in die Düngung.",
      categoryHandles: ["duenger"],
      titleTerms: ["bio-grow", "calmag", "starter pack"],
      handleTerms: ["bio-grow", "calmag", "try-pack"],
      manufacturers: ["BioBizz"],
      excludeTitleTerms: ["topmax"],
    };
  }

  if (value.includes("licht") || value.includes("hitz")) {
    return {
      reason: "Hilft bei Luftbewegung und Hitzestau im Pflanzenbereich.",
      categoryHandles: ["ventilatoren"],
      titleTerms: ["clipventilator", "cloudray"],
      handleTerms: ["clipventilator", "cloudray"],
      manufacturers: ["RAM", "AC Infinity"],
    };
  }

  if (value.includes("schimmel")) {
    return {
      reason: "Hilft bei Luftzirkulation und Feuchtigkeitskontrolle.",
      categoryHandles: ["ventilatoren", "luftentfeuchter"],
      titleTerms: ["clipventilator", "cloudray", "luftentfeuchter"],
      handleTerms: ["clipventilator", "cloudray", "luftentfeuchter"],
      manufacturers: ["RAM", "AC Infinity"],
    };
  }

  if (
    value.includes("schädl") ||
    value.includes("thrips") ||
    value.includes("spinnmil")
  ) {
    return {
      reason: "Für diesen Befund gibt es aktuell keine wirklich passende Produktempfehlung im Shop.",
      skip: true,
    };
  }

  if (value.includes("überwässer") || value.includes("unterwässer")) {
    return {
      reason: "Dieser Befund braucht vor allem Gießanpassung, nicht blind ein Zusatzprodukt.",
      skip: true,
    };
  }

  return {
    reason: "Für diesen Befund gibt es aktuell keine saubere Produktempfehlung im Shop.",
    skip: true,
  };
}

function toProductSuggestion(
  product: ProductSuggestionRecord,
  reason: string,
): PlantAnalyzerProductSuggestion {
  const minPrice =
    product.variants.length > 0
      ? Math.min(...product.variants.map((variant) => variant.priceCents))
      : null;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    imageUrl: product.images[0]?.url ?? null,
    imageAlt: product.images[0]?.altText ?? product.title,
    price:
      minPrice !== null
        ? { amount: toAmount(minPrice), currencyCode: CURRENCY_CODE }
        : null,
    reason,
  };
}

async function findProductsForProfile(
  profile: ProductSearchProfile,
  take = 4,
): Promise<ProductSuggestionRecord[]> {
  const orFilters: Prisma.ProductWhereInput[] = [];

  for (const term of profile.titleTerms ?? []) {
    orFilters.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  for (const term of profile.handleTerms ?? []) {
    orFilters.push({
      handle: { contains: term, mode: "insensitive" },
    });
  }

  for (const categoryHandle of profile.categoryHandles ?? []) {
    orFilters.push({
      categories: {
        some: {
          category: { handle: categoryHandle },
        },
      },
    });
  }

  return prisma.product.findMany({
    where: {
      status: "ACTIVE",
      AND: [
        orFilters.length > 0 ? { OR: orFilters } : {},
        profile.manufacturers?.length
          ? { manufacturer: { in: profile.manufacturers } }
          : {},
        profile.excludeTitleTerms?.length
          ? {
              NOT: profile.excludeTitleTerms.map((term) => ({
                OR: [
                  { title: { contains: term, mode: "insensitive" } },
                  {
                    shortDescription: {
                      contains: term,
                      mode: "insensitive",
                    },
                  },
                  { description: { contains: term, mode: "insensitive" } },
                ],
              })),
            }
          : {},
        profile.excludeHandleTerms?.length
          ? {
              NOT: profile.excludeHandleTerms.map((term) => ({
                handle: { contains: term, mode: "insensitive" },
              })),
            }
          : {},
        {
          NOT: {
            categories: {
              some: {
                category: {
                  handle: { in: GLOBAL_EXCLUDED_CATEGORY_HANDLES },
                },
              },
            },
          },
        },
      ],
    },
    orderBy: [
      { bestsellerScore: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: {
        orderBy: { position: "asc" },
        select: { priceCents: true },
      },
    },
    take,
  });
}

function getFallbackProductProfiles(
  issues: PlantAnalyzerIssue[],
): ProductSearchProfile[] {
  const issueText = issues.map((issue) => issue.label.toLowerCase()).join(" ");

  if (
    issueText.includes("schädl") ||
    issueText.includes("thrips") ||
    issueText.includes("spinnmil") ||
    issueText.includes("schimmel") ||
    issueText.includes("licht") ||
    issueText.includes("hitz")
  ) {
    return [
      {
        reason:
          "Kein direktes Spezialmittel im Shop, aber sinnvolle Klima- und Setup-Produkte zur Stabilisierung.",
        categoryHandles: ["ventilatoren", "luftentfeuchter"],
        titleTerms: ["clipventilator", "cloudray", "luftentfeuchter"],
        handleTerms: ["clipventilator", "cloudray", "luftentfeuchter"],
        manufacturers: ["RAM", "AC Infinity"],
      },
      {
        reason:
          "Als allgemeine Basis für stabile Pflanzenwerte und eine saubere Pflege sinnvoll.",
        categoryHandles: ["ph-regulatoren", "duenger"],
        titleTerms: ["ph down", "ph up", "calmag", "bio-grow"],
        handleTerms: ["ph-down", "ph-up", "calmag", "bio-grow"],
        manufacturers: ["BioBizz"],
      },
    ];
  }

  if (
    issueText.includes("überwässer") ||
    issueText.includes("unterwässer") ||
    issueText.includes("ph") ||
    issueText.includes("nährstoff") ||
    issueText.includes("calcium") ||
    issueText.includes("magnes") ||
    issueText.includes("stickstoff") ||
    issueText.includes("kali")
  ) {
    return [
      {
        reason:
          "Als sichere Basis für Wasser-, pH- und Nährstoffmanagement im Setup sinnvoll.",
        categoryHandles: ["duenger", "ph-regulatoren"],
        titleTerms: ["calmag", "bio-grow", "bio-bloom", "ph down", "ph up"],
        handleTerms: ["calmag", "bio-grow", "bio-bloom", "ph-down", "ph-up"],
        manufacturers: ["BioBizz"],
      },
      {
        reason:
          "Zusätzlich sinnvoll, um das Klima rund um die Pflanze stabiler zu halten.",
        categoryHandles: ["ventilatoren"],
        titleTerms: ["clipventilator", "cloudray"],
        handleTerms: ["clipventilator", "cloudray"],
        manufacturers: ["RAM", "AC Infinity"],
      },
    ];
  }

  return [
    {
      reason:
        "Als allgemeine Grow-Basis für stabile Pflanzenwerte und eine sinnvollere Ersteinschätzung geeignet.",
      categoryHandles: ["duenger", "ph-regulatoren", "ventilatoren"],
      titleTerms: [
        "calmag",
        "bio-grow",
        "bio-bloom",
        "ph down",
        "clipventilator",
      ],
      handleTerms: [
        "calmag",
        "bio-grow",
        "bio-bloom",
        "ph-down",
        "clipventilator",
      ],
      manufacturers: ["BioBizz", "RAM", "AC Infinity"],
    },
  ];
}

export async function getPlantAnalyzerProductSuggestions(
  issues: PlantAnalyzerIssue[],
): Promise<PlantAnalyzerProductSuggestion[]> {
  const rankedIssues = issues
    .filter((issue) => issue.label.toLowerCase() !== "kein akuter befund")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  const suggestions: PlantAnalyzerProductSuggestion[] = [];
  const seen = new Set<string>();

  for (const issue of rankedIssues) {
    const profile = getIssueProductProfile(issue);
    if (profile.skip) continue;
    const matches = await findProductsForProfile(profile);

    for (const product of matches) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      suggestions.push(toProductSuggestion(product, profile.reason));
      if (suggestions.length >= 4) {
        return suggestions;
      }
    }
  }

  if (suggestions.length === 0) {
    for (const fallbackProfile of getFallbackProductProfiles(rankedIssues)) {
      const matches = await findProductsForProfile(fallbackProfile);

      for (const product of matches) {
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        suggestions.push(toProductSuggestion(product, fallbackProfile.reason));
        if (suggestions.length >= 4) {
          return suggestions;
        }
      }
    }
  }

  return suggestions;
}

export function getPlantAnalyzerGuideSuggestions(
  issues: PlantAnalyzerIssue[],
): PlantAnalyzerGuideSuggestion[] {
  const issueText = issues.map((issue) => issue.label.toLowerCase()).join(" ");

  const picks = new Set<string>();
  if (
    issueText.includes("calcium") ||
    issueText.includes("magnes") ||
    issueText.includes("stickstoff") ||
    issueText.includes("kali") ||
    issueText.includes("nährstoff") ||
    issueText.includes("ph")
  ) {
    picks.add("duenger-vergleich");
  }
  if (
    issueText.includes("licht") ||
    issueText.includes("hitz") ||
    issueText.includes("schimmel") ||
    issueText.includes("überwässer") ||
    issueText.includes("unterwässer")
  ) {
    picks.add("growbox-einsteiger-guide");
  }
  if (picks.size === 0) {
    picks.add("growbox-einsteiger-guide");
    picks.add("duenger-vergleich");
  }

  return blogPosts
    .filter((post) => picks.has(post.slug))
    .slice(0, 2)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      href: `/blog/${post.slug}`,
    }));
}
