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

export type OrderSourceSnapshot = {
  sourceStorefront: Storefront | null;
  sourceHost: string | null;
  sourceOrigin: string | null;
};

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
  const host =
    forwardedHost ??
    normalizeHost(request.headers.get("host")) ??
    requestUrl.host;
  const origin =
    sanitizeOrigin(request.headers.get("origin")) ??
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
): OrderSourceSnapshot => {
  const sourceHost = normalizeHost(metadata?.sourceHost ?? null);
  const explicitStorefront = parseStorefront(metadata?.sourceStorefront ?? null);

  return {
    sourceStorefront: explicitStorefront ?? resolveStorefrontFromHost(sourceHost),
    sourceHost,
    sourceOrigin: sanitizeOrigin(metadata?.sourceOrigin ?? null),
  };
};

export const formatOrderSourceLabel = (
  sourceStorefront?: string | null,
  sourceHost?: string | null,
) => {
  const storefront = parseStorefront(sourceStorefront ?? null);
  if (storefront) {
    return STOREFRONT_LABELS[storefront];
  }
  return sourceHost?.trim() || "Unknown website";
};
