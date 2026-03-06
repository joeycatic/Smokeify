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

const CURRENCY_CODE = "EUR";
const toAmount = (cents: number) => (cents / 100).toFixed(2);

function buildIssueSearchTerms(issue: PlantAnalyzerIssue) {
  const value = issue.label.toLowerCase();
  if (value.includes("calcium") || value.includes("magnes")) {
    return {
      terms: ["calmag", "calcium", "magnesium", "calcium magnesium"],
      reason: "Passend bei Verdacht auf Calcium- oder Magnesiummangel.",
    };
  }
  if (value.includes("stickstoff") || value.includes("nährstoff")) {
    return {
      terms: ["dünger", "duenger", "grow", "bio", "base nutrient"],
      reason: "Passend zur Nährstoffversorgung und Basisdüngung.",
    };
  }
  if (value.includes("kali")) {
    return {
      terms: ["bloom", "blüte", "bluete", "pk", "dünger", "duenger"],
      reason: "Passend bei Verdacht auf Kalium- oder Blütedüngungsprobleme.",
    };
  }
  if (value.includes("überwässer") || value.includes("unterwässer")) {
    return {
      terms: ["substrat", "erde", "topf", "bewässer", "bewaesser"],
      reason: "Hilft bei Gießrhythmus und Wurzelzone.",
    };
  }
  if (value.includes("licht") || value.includes("hitz")) {
    return {
      terms: ["led", "lampe", "clip fan", "ventilator", "lüfter", "luefter"],
      reason: "Hilft bei Lichtabstand, Intensität und Klima.",
    };
  }
  if (
    value.includes("schädl") ||
    value.includes("thrips") ||
    value.includes("spinnmil")
  ) {
    return {
      terms: ["neem", "pflanzenschutz", "sprüh", "sprueh", "sticky", "gelbtafel"],
      reason: "Sinnvoll bei Schädlingskontrolle und Monitoring.",
    };
  }
  if (value.includes("schimmel")) {
    return {
      terms: ["entfeucht", "luft", "lüfter", "luefter", "clip fan"],
      reason: "Hilft bei Luftzirkulation und Feuchtigkeitsmanagement.",
    };
  }

  return {
    terms: issue.label
      .split(/[\s,/()]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4)
      .slice(0, 5),
    reason: "Ausgewählt auf Basis der erkannten Symptome.",
  };
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
    const { terms, reason } = buildIssueSearchTerms(issue);
    if (terms.length === 0) continue;

    const orFilters: Prisma.ProductWhereInput[] = terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { manufacturer: { contains: term, mode: "insensitive" } },
        { tags: { has: term.toLowerCase() } },
        {
          categories: {
            some: {
              OR: [
                { category: { name: { contains: term, mode: "insensitive" } } },
                { category: { handle: { contains: term, mode: "insensitive" } } },
              ],
            },
          },
        },
      ],
    }));

    const matches = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: orFilters,
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
      take: 4,
    });

    for (const product of matches) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      const minPrice =
        product.variants.length > 0
          ? Math.min(...product.variants.map((variant) => variant.priceCents))
          : null;
      suggestions.push({
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
      });
      if (suggestions.length >= 4) {
        return suggestions;
      }
    }
  }

  if (suggestions.length >= 3) {
    return suggestions;
  }

  const fallback = await prisma.product.findMany({
    where: { status: "ACTIVE" },
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
    take: 4,
  });

  for (const product of fallback) {
    if (seen.has(product.id)) continue;
    const minPrice =
      product.variants.length > 0
        ? Math.min(...product.variants.map((variant) => variant.priceCents))
        : null;
    suggestions.push({
      id: product.id,
      title: product.title,
      handle: product.handle,
      imageUrl: product.images[0]?.url ?? null,
      imageAlt: product.images[0]?.altText ?? product.title,
      price:
        minPrice !== null
          ? { amount: toAmount(minPrice), currencyCode: CURRENCY_CODE }
          : null,
      reason: "Beliebte Produkte aus dem Shop für Pflege, Klima und Setup.",
    });
    if (suggestions.length >= 4) {
      break;
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
