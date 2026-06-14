import {
  getStorefrontConfig,
  STOREFRONTS,
  type StorefrontCode,
} from "@/lib/storefronts";

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
      ...getStorefrontConfig("MAIN").knownHosts,
      ...getStorefrontConfig("MAIN").publicOriginEnvKeys.map((key) =>
        parseStorefrontHostFromUrl(process.env[key]),
      ),
      ...getStorefrontConfig("MAIN").hostEnvKeys.flatMap((key) =>
        splitConfiguredHosts(process.env[key]),
      ),
    ].filter((entry): entry is string => Boolean(entry)),
  ),
  GROW: new Set(
    [
      ...getStorefrontConfig("GROW").knownHosts,
      ...getStorefrontConfig("GROW").publicOriginEnvKeys.map((key) =>
        parseStorefrontHostFromUrl(process.env[key]),
      ),
      ...getStorefrontConfig("GROW").hostEnvKeys.flatMap((key) =>
        splitConfiguredHosts(process.env[key]),
      ),
    ].filter((entry): entry is string => Boolean(entry)),
  ),
});

export const resolveStorefrontFromHost = (
  host?: string | null,
): StorefrontCode | null => {
  const normalizedHost = normalizeStorefrontHost(host);
  if (!normalizedHost) return null;

  const configuredHosts = getConfiguredHostsByStorefront();
  for (const storefront of STOREFRONTS) {
    if (configuredHosts[storefront].has(normalizedHost)) {
      return storefront;
    }
  }

  return null;
};
