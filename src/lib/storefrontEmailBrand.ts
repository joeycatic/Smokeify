import "server-only";

import { parseStorefront, type StorefrontCode } from "@/lib/storefronts";
import {
  getConfiguredHostsByStorefront,
  parseStorefrontHostFromUrl,
} from "@/lib/storefrontHosts";

export type StorefrontEmailBrandMeta = {
  brandName: string;
  accentColor: string;
  headerColor: string;
  backgroundColor: string;
  heroBackground: string;
  heroLabelColor: string;
  heroMutedTextColor: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  panelBackgroundColor: string;
  panelBorderColor: string;
  noticeBackgroundColor: string;
  noticeBorderColor: string;
  textColor: string;
  mutedTextColor: string;
  subtleTextColor: string;
  footerTextColor: string;
  footerMutedTextColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  secondaryButtonBackgroundColor: string;
  secondaryButtonTextColor: string;
  emphasisColor: string;
  ctaLabel: string;
  footerDescription: string;
};

const BRAND_META: Record<StorefrontCode, StorefrontEmailBrandMeta> = {
  MAIN: {
    brandName: "Smokeify",
    accentColor: "#E4C56C",
    headerColor: "#2f3e36",
    backgroundColor: "#f6f5f2",
    heroBackground:
      "linear-gradient(135deg,#2f3e36 0%,#365046 52%,#6f725c 100%)",
    heroLabelColor: "#F0DEA0",
    heroMutedTextColor: "rgba(255,255,255,0.72)",
    cardBackgroundColor: "#ffffff",
    cardBorderColor: "#e8eaed",
    panelBackgroundColor: "#f9fafb",
    panelBorderColor: "#e5e7eb",
    noticeBackgroundColor: "#f0fdf4",
    noticeBorderColor: "#2f3e36",
    textColor: "#1a2a22",
    mutedTextColor: "#4b5563",
    subtleTextColor: "#9ca3af",
    footerTextColor: "#9ca3af",
    footerMutedTextColor: "#d1d5db",
    buttonBackgroundColor: "#2f3e36",
    buttonTextColor: "#ffffff",
    secondaryButtonBackgroundColor: "#f3f4f6",
    secondaryButtonTextColor: "#1a2a22",
    emphasisColor: "#2f3e36",
    ctaLabel: "Jetzt shoppen",
    footerDescription:
      "Du erhältst diese E-Mail, weil du Marketing-E-Mails von Smokeify abonniert hast.",
  },
  GROW: {
    brandName: "GrowVault",
    accentColor: "#B8D876",
    headerColor: "#10261d",
    backgroundColor: "#eef4ec",
    heroBackground:
      "linear-gradient(135deg,#0d2219 0%,#143126 44%,#1d4532 76%,#8ea85f 100%)",
    heroLabelColor: "#E4F0BF",
    heroMutedTextColor: "rgba(232,244,228,0.82)",
    cardBackgroundColor: "#fbfdf9",
    cardBorderColor: "#d7e3d4",
    panelBackgroundColor: "#eef5ea",
    panelBorderColor: "#d2dfcf",
    noticeBackgroundColor: "#e4f0df",
    noticeBorderColor: "#7ea35e",
    textColor: "#16261d",
    mutedTextColor: "#486152",
    subtleTextColor: "#78907c",
    footerTextColor: "#738676",
    footerMutedTextColor: "#98ab9a",
    buttonBackgroundColor: "#163a2a",
    buttonTextColor: "#f6fbf4",
    secondaryButtonBackgroundColor: "#e2ecdf",
    secondaryButtonTextColor: "#163126",
    emphasisColor: "#163a2a",
    ctaLabel: "Grow entdecken",
    footerDescription:
      "Du erhältst diese E-Mail, weil du Marketing-E-Mails von GrowVault abonniert hast.",
  },
};

const toOrigin = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const resolveStorefrontFromCandidates = (
  candidates: Array<string | null | undefined>,
): StorefrontCode | null => {
  const configuredHosts = getConfiguredHostsByStorefront();
  for (const candidate of candidates) {
    const host = parseStorefrontHostFromUrl(candidate);
    if (!host) continue;
    if (configuredHosts.GROW.has(host)) return "GROW";
    if (configuredHosts.MAIN.has(host)) return "MAIN";
  }
  return null;
};

export const getStorefrontEmailBrand = (storefront: StorefrontCode) =>
  BRAND_META[storefront];

export const resolveStorefrontEmailBrand = (
  storefront?: string | null,
  candidates: Array<string | null | undefined> = [],
): StorefrontCode => {
  const explicitStorefront = parseStorefront(storefront ?? null);
  if (explicitStorefront) {
    return explicitStorefront;
  }

  return resolveStorefrontFromCandidates(candidates) ?? "MAIN";
};

export const getStorefrontOrigin = (
  storefront: StorefrontCode,
  fallbackOrigin?: string | null,
) => {
  if (storefront === "GROW") {
    return (
      toOrigin(process.env.NEXT_PUBLIC_GROW_APP_URL) ??
      toOrigin(fallbackOrigin) ??
      toOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
      toOrigin(process.env.NEXTAUTH_URL) ??
      "http://localhost:3000"
    );
  }

  return (
    toOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    toOrigin(process.env.NEXTAUTH_URL) ??
    toOrigin(fallbackOrigin) ??
    "http://localhost:3000"
  );
};

export const getStorefrontLinks = (
  storefront: StorefrontCode,
  fallbackOrigin?: string | null,
) => {
  const origin = getStorefrontOrigin(storefront, fallbackOrigin);

  return {
    origin,
    shopUrl: `${origin}/products`,
    privacyUrl: `${origin}/pages/privacy`,
    termsUrl: `${origin}/pages/agb`,
  };
};
