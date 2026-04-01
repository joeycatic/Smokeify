import "server-only";

import { type StorefrontCode } from "@/lib/storefronts";

export type StorefrontEmailBrandMeta = {
  brandName: string;
  accentColor: string;
  headerColor: string;
  backgroundColor: string;
  ctaLabel: string;
  footerDescription: string;
};

const BRAND_META: Record<StorefrontCode, StorefrontEmailBrandMeta> = {
  MAIN: {
    brandName: "Smokeify",
    accentColor: "#E4C56C",
    headerColor: "#2f3e36",
    backgroundColor: "#f6f5f2",
    ctaLabel: "Jetzt shoppen",
    footerDescription:
      "Du erhältst diese E-Mail, weil du Marketing-E-Mails von Smokeify abonniert hast.",
  },
  GROW: {
    brandName: "GrowVault",
    accentColor: "#8FD694",
    headerColor: "#143126",
    backgroundColor: "#f3f8f2",
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

export const getStorefrontEmailBrand = (storefront: StorefrontCode) =>
  BRAND_META[storefront];

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
