import "server-only";

import { getStorefrontOrigin, resolveStorefrontEmailBrand } from "@/lib/storefrontEmailBrand";
import { type StorefrontCode } from "@/lib/storefronts";
import {
  normalizeStorefrontHost,
  parseStorefrontHostFromUrl,
  resolveStorefrontFromHost,
} from "@/lib/storefrontHosts";

type HeaderBag =
  | Headers
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>
  | undefined;

function readHeader(headers: HeaderBag, name: string) {
  if (!headers) return null;
  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(name);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const candidate = record[name] ?? record[name.toLowerCase()];
  return Array.isArray(candidate) ? candidate[0] ?? null : candidate ?? null;
}

export function resolveStorefrontFromHeaders(headers: HeaderBag): StorefrontCode | null {
  const origin = readHeader(headers, "origin");
  const referer = readHeader(headers, "referer");
  const forwardedHost = normalizeStorefrontHost(readHeader(headers, "x-forwarded-host"));
  const host =
    forwardedHost ??
    normalizeStorefrontHost(readHeader(headers, "host")) ??
    parseStorefrontHostFromUrl(origin) ??
    parseStorefrontHostFromUrl(referer);

  return resolveStorefrontFromHost(host);
}

export function resolveStorefrontFromRequest(request: Request) {
  return resolveStorefrontFromHeaders(request.headers);
}

export function resolvePreferredUserStorefront(
  storefront?: string | null,
  candidates: Array<string | null | undefined> = []
) {
  return resolveStorefrontEmailBrand(storefront ?? null, candidates);
}

export function getPreferredUserAuthOrigin(
  storefront?: string | null,
  fallbackOrigin?: string | null
) {
  const resolvedStorefront = resolvePreferredUserStorefront(storefront, [fallbackOrigin]);
  return getStorefrontOrigin(resolvedStorefront, fallbackOrigin);
}
