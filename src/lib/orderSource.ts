import type { Storefront } from "@prisma/client";
import { parseStorefront, STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";

const normalizeHost = (value?: string | null) =>
  value
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()
    .replace(/:\d+$/, "") ?? null;

const parseHostFromUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return normalizeHost(new URL(trimmed).host);
  } catch {
    return normalizeHost(trimmed);
  }
};

const splitConfiguredHosts = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((entry) => parseHostFromUrl(entry))
    .filter((entry): entry is string => Boolean(entry));

const getConfiguredHostsByStorefront = (): Record<StorefrontCode, Set<string>> => ({
  MAIN: new Set(
    [
      parseHostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      parseHostFromUrl(process.env.NEXTAUTH_URL),
      ...splitConfiguredHosts(process.env.MAIN_STOREFRONT_HOSTS),
    ].filter((entry): entry is string => Boolean(entry)),
  ),
  GROW: new Set(
    [
      parseHostFromUrl(process.env.NEXT_PUBLIC_GROW_APP_URL),
      ...splitConfiguredHosts(process.env.GROW_STOREFRONT_HOSTS),
    ].filter((entry): entry is string => Boolean(entry)),
  ),
});

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

const resolveStorefrontFromHost = (host: string | null): Storefront | null => {
  if (!host) return null;
  const configuredHosts = getConfiguredHostsByStorefront();
  for (const storefront of ["MAIN", "GROW"] as const) {
    if (configuredHosts[storefront].has(host)) {
      return storefront;
    }
  }
  return null;
};

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
      host: normalizeHost(parsed.host),
      origin: parsed.origin,
    };
  } catch {
    return { host: null, origin: null };
  }
};

export const resolveOrderSourceFromRequest = (request: Request): OrderSourceSnapshot => {
  const requestUrl = parseRequestUrl(request.url);
  const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"));
  const originHeader = sanitizeOrigin(request.headers.get("origin"));
  const originHost = parseHostFromUrl(originHeader);
  const host =
    forwardedHost ??
    normalizeHost(request.headers.get("host")) ??
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
    sourceStorefront: resolveStorefrontFromHost(host),
    sourceHost: host,
    sourceOrigin: origin,
  };
};

export const resolveOrderSourceFromMetadata = (
  metadata?: Record<string, string | null | undefined> | null,
  fallbackUrls: Array<string | null | undefined> = [],
): OrderSourceSnapshot => {
  const fallbackOrigin = pickFirst(fallbackUrls.map((value) => sanitizeOrigin(value)));
  const fallbackHost = pickFirst(fallbackUrls.map((value) => parseHostFromUrl(value)));
  const sourceOrigin = sanitizeOrigin(metadata?.sourceOrigin ?? null) ?? fallbackOrigin;
  const sourceHost =
    normalizeHost(metadata?.sourceHost ?? null) ??
    parseHostFromUrl(sourceOrigin) ??
    fallbackHost;
  const explicitStorefront = parseStorefront(metadata?.sourceStorefront ?? null);

  return {
    sourceStorefront: explicitStorefront ?? resolveStorefrontFromHost(sourceHost),
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
  return normalizeHost(sourceHost ?? null) ?? parseHostFromUrl(sourceOrigin) ?? "Unknown website";
};
