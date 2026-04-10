import { type StorefrontCode } from "@/lib/storefronts";

const KNOWN_STOREFRONT_HOSTS: Record<StorefrontCode, string[]> = {
  MAIN: ["smokeify.de", "www.smokeify.de"],
  GROW: ["growvault.de", "www.growvault.de"],
};

export const normalizeStorefrontHost = (value?: string | null) =>
  value
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()
    .replace(/:\d+$/, "") ?? null;

export const parseStorefrontHostFromUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return normalizeStorefrontHost(new URL(trimmed).host);
  } catch {
    return normalizeStorefrontHost(trimmed);
  }
};

const splitConfiguredHosts = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((entry) => parseStorefrontHostFromUrl(entry))
    .filter((entry): entry is string => Boolean(entry));

export const getConfiguredHostsByStorefront = (): Record<
  StorefrontCode,
  Set<string>
> => ({
  MAIN: new Set(
    [
      ...KNOWN_STOREFRONT_HOSTS.MAIN,
      parseStorefrontHostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
      parseStorefrontHostFromUrl(process.env.NEXTAUTH_URL),
      ...splitConfiguredHosts(process.env.MAIN_STOREFRONT_HOSTS),
    ].filter((entry): entry is string => Boolean(entry)),
  ),
  GROW: new Set(
    [
      ...KNOWN_STOREFRONT_HOSTS.GROW,
      parseStorefrontHostFromUrl(process.env.NEXT_PUBLIC_GROW_APP_URL),
      ...splitConfiguredHosts(process.env.GROW_STOREFRONT_HOSTS),
    ].filter((entry): entry is string => Boolean(entry)),
  ),
});

export const resolveStorefrontFromHost = (
  host?: string | null,
): StorefrontCode | null => {
  const normalizedHost = normalizeStorefrontHost(host);
  if (!normalizedHost) return null;

  const configuredHosts = getConfiguredHostsByStorefront();
  for (const storefront of ["MAIN", "GROW"] as const) {
    if (configuredHosts[storefront].has(normalizedHost)) {
      return storefront;
    }
  }

  return null;
};
