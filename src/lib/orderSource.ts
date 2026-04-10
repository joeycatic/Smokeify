import type { Storefront } from "@prisma/client";
import { parseStorefront, STOREFRONT_LABELS } from "@/lib/storefronts";
import {
  getConfiguredHostsByStorefront,
  normalizeStorefrontHost,
  parseStorefrontHostFromUrl,
  resolveStorefrontFromHost,
} from "@/lib/storefrontHosts";

export const getConfiguredRequestHosts = () => {
  const configuredHosts = getConfiguredHostsByStorefront();
  return new Set([...configuredHosts.MAIN, ...configuredHosts.GROW]);
};

export type OrderSourceSnapshot = {
  sourceStorefront: Storefront | null;
  sourceHost: string | null;
  sourceOrigin: string | null;
};

const pickFirst = (values: Array<string | null | undefined>) =>
  values.find((value): value is string => Boolean(value)) ?? null;

const sanitizeOrigin = (value?: string | null) => {
  const trimmed = value?.split(",")[0]?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

export const getConfiguredStorefrontOrigin = (storefront?: string | null) => {
  const normalizedStorefront = parseStorefront(storefront ?? null);
  if (normalizedStorefront === "GROW") {
    return sanitizeOrigin(process.env.NEXT_PUBLIC_GROW_APP_URL) ?? null;
  }

  if (normalizedStorefront === "MAIN") {
    return (
      sanitizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
      sanitizeOrigin(process.env.NEXTAUTH_URL) ??
      null
    );
  }

  return null;
};

const parseRequestUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { host: null, origin: null };
  }

  try {
    const parsed = new URL(trimmed);
    return {
      host: normalizeStorefrontHost(parsed.host),
      origin: parsed.origin,
    };
  } catch {
    return { host: null, origin: null };
  }
};

export const resolveOrderSourceFromRequest = (request: Request): OrderSourceSnapshot => {
  const requestUrl = parseRequestUrl(request.url);
  const forwardedHost = normalizeStorefrontHost(request.headers.get("x-forwarded-host"));
  const originHeader = sanitizeOrigin(request.headers.get("origin"));
  const originHost = parseStorefrontHostFromUrl(originHeader);
  const host =
    forwardedHost ??
    normalizeStorefrontHost(request.headers.get("host")) ??
    originHost ??
    requestUrl.host;
  const origin =
    originHeader ??
    (host
      ? sanitizeOrigin(
          `${request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"}://${host}`,
        )
      : null) ??
    requestUrl.origin;

  return {
    sourceStorefront: resolveStorefrontFromHost(host) as Storefront | null,
    sourceHost: host,
    sourceOrigin: origin,
  };
};

export const resolveOrderSourceFromMetadata = (
  metadata?: Record<string, string | null | undefined> | null,
  fallbackUrls: Array<string | null | undefined> = [],
): OrderSourceSnapshot => {
  const fallbackOrigin = pickFirst(fallbackUrls.map((value) => sanitizeOrigin(value)));
  const fallbackHost = pickFirst(
    fallbackUrls.map((value) => parseStorefrontHostFromUrl(value)),
  );
  const sourceOrigin = sanitizeOrigin(metadata?.sourceOrigin ?? null) ?? fallbackOrigin;
  const sourceHost =
    normalizeStorefrontHost(metadata?.sourceHost ?? null) ??
    parseStorefrontHostFromUrl(sourceOrigin) ??
    fallbackHost;
  const explicitStorefront = parseStorefront(metadata?.sourceStorefront ?? null);

  return {
    sourceStorefront:
      explicitStorefront ?? (resolveStorefrontFromHost(sourceHost) as Storefront | null),
    sourceHost,
    sourceOrigin,
  };
};

export const resolveCheckoutOrigin = (
  orderSource: Pick<OrderSourceSnapshot, "sourceStorefront" | "sourceOrigin">,
) =>
  sanitizeOrigin(orderSource.sourceOrigin) ??
  getConfiguredStorefrontOrigin(orderSource.sourceStorefront) ??
  getConfiguredStorefrontOrigin("MAIN") ??
  "http://localhost:3000";

export const formatOrderSourceLabel = (
  sourceStorefront?: string | null,
  sourceHost?: string | null,
  sourceOrigin?: string | null,
) => {
  const storefront = parseStorefront(sourceStorefront ?? null);
  if (storefront) {
    return STOREFRONT_LABELS[storefront];
  }
  return (
    normalizeStorefrontHost(sourceHost ?? null) ??
    parseStorefrontHostFromUrl(sourceOrigin) ??
    "Unknown website"
  );
};
