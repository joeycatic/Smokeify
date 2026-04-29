const DEFAULT_GROWVAULT_PUBLIC_URL = "https://www.growvault.de";

export const GROWVAULT_ANALYZER_PATH = "/pflanzen-analyse";
export const GROWVAULT_CUSTOMIZER_PATH = "/customizer";
export const GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE = "2026-06-15";
export const GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE = "2026-06-15";

function normalizeUrl(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function normalizeSearch(search?: string) {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

export const GROWVAULT_PUBLIC_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_GROWVAULT_APP_URL ??
    process.env.GROWVAULT_APP_URL ??
    undefined,
  DEFAULT_GROWVAULT_PUBLIC_URL,
);

export function buildGrowvaultPublicUrl(pathname = "/", search?: string) {
  const target = new URL(pathname, `${GROWVAULT_PUBLIC_URL}/`);
  target.search = normalizeSearch(search);
  return target.toString();
}

export function buildGrowvaultAnalyzerUrl(search?: string) {
  return buildGrowvaultPublicUrl(GROWVAULT_ANALYZER_PATH, search);
}

export function buildGrowvaultCustomizerUrl(search?: string) {
  return buildGrowvaultPublicUrl(GROWVAULT_CUSTOMIZER_PATH, search);
}

function logGrowvaultStorefrontBridge(input: {
  surface: "analyzer" | "customizer";
  removalDate: string;
  sourcePath: string;
  targetPath: string;
  method: string;
  mode: "redirect" | "proxy";
}) {
  console.info(
    `[smokeify-${input.surface}-bridge] ${JSON.stringify({
      removalDate: input.removalDate,
      sourcePath: input.sourcePath,
      targetPath: input.targetPath,
      method: input.method,
      mode: input.mode,
      owner: "growvault",
    })}`,
  );
}

export function logGrowvaultAnalyzerBridge(input: {
  sourcePath: string;
  targetPath: string;
  method: string;
  mode: "redirect" | "proxy";
}) {
  logGrowvaultStorefrontBridge({
    surface: "analyzer",
    removalDate: GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE,
    ...input,
  });
}

export function logGrowvaultCustomizerBridge(input: {
  sourcePath: string;
  targetPath: string;
  method: string;
  mode: "redirect" | "proxy";
}) {
  logGrowvaultStorefrontBridge({
    surface: "customizer",
    removalDate: GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE,
    ...input,
  });
}
