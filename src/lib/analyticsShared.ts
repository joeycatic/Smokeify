export const ANALYTICS_CONSENT_KEY = "smokeify_cookie_consent";
export const ANALYTICS_SESSION_STORAGE_KEY = "smokeify_analytics_session_v1";
export const ANALYTICS_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ANALYTICS_HEARTBEAT_INTERVAL_MS = 30 * 1000;
export const ACTIVE_ANALYTICS_WINDOW_MINUTES = 5;

export type TrafficAttributionInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  currentHost?: string | null;
  paidClickSource?: string | null;
  paidClickCampaign?: string | null;
};

export type TrafficAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

const normalizeHost = (host: string | null | undefined) =>
  host
    ?.trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/:\d+$/, "") ?? "";

const compactTrackingValue = (value: string | null | undefined, maxLength: number) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const parseReferrerHost = (referrer: string | null | undefined) => {
  const trimmed = referrer?.trim();
  if (!trimmed) return "";
  try {
    return normalizeHost(new URL(trimmed).host);
  } catch {
    return "";
  }
};

const isSearchHost = (host: string, needles: string[]) =>
  needles.some((needle) => host === needle || host.endsWith(`.${needle}`));

const resolveReferrerSource = (
  referrer: string | null | undefined,
  currentHost: string | null | undefined,
): Pick<TrafficAttribution, "utmSource" | "utmMedium"> | null => {
  const referrerHost = parseReferrerHost(referrer);
  if (!referrerHost) return null;

  const normalizedCurrentHost = normalizeHost(currentHost);
  if (normalizedCurrentHost && referrerHost === normalizedCurrentHost) {
    return null;
  }

  if (isSearchHost(referrerHost, ["google.com", "google.de"])) {
    return { utmSource: "google", utmMedium: "organic" };
  }
  if (isSearchHost(referrerHost, ["bing.com"])) {
    return { utmSource: "bing", utmMedium: "organic" };
  }
  if (isSearchHost(referrerHost, ["duckduckgo.com"])) {
    return { utmSource: "duckduckgo", utmMedium: "organic" };
  }
  if (isSearchHost(referrerHost, ["ecosia.org"])) {
    return { utmSource: "ecosia", utmMedium: "organic" };
  }
  if (isSearchHost(referrerHost, ["youtube.com", "youtu.be"])) {
    return { utmSource: "youtube", utmMedium: "referral" };
  }
  if (isSearchHost(referrerHost, ["instagram.com"])) {
    return { utmSource: "instagram", utmMedium: "social" };
  }
  if (isSearchHost(referrerHost, ["facebook.com", "fb.com"])) {
    return { utmSource: "facebook", utmMedium: "social" };
  }
  if (isSearchHost(referrerHost, ["growvault.de"])) {
    return { utmSource: "growvault", utmMedium: "referral" };
  }

  return { utmSource: referrerHost, utmMedium: "referral" };
};

export const resolveTrafficAttribution = (
  input: TrafficAttributionInput,
): TrafficAttribution => {
  const explicitSource = compactTrackingValue(input.utmSource, 120);
  const explicitMedium = compactTrackingValue(input.utmMedium, 120);
  const explicitCampaign = compactTrackingValue(input.utmCampaign, 160);
  if (explicitSource || explicitMedium || explicitCampaign) {
    return {
      utmSource: explicitSource,
      utmMedium: explicitMedium,
      utmCampaign: explicitCampaign,
    };
  }

  const paidClickSource = compactTrackingValue(input.paidClickSource, 120);
  if (paidClickSource) {
    return {
      utmSource: paidClickSource,
      utmMedium: "cpc",
      utmCampaign: compactTrackingValue(input.paidClickCampaign, 160),
    };
  }

  const referrerSource = resolveReferrerSource(input.referrer, input.currentHost);
  if (referrerSource) {
    return {
      ...referrerSource,
      utmCampaign: null,
    };
  }

  return {
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
  };
};

export type AnalyticsPageType =
  | "home"
  | "category"
  | "product"
  | "cart"
  | "checkout"
  | "account"
  | "auth"
  | "wishlist"
  | "content"
  | "utility"
  | "other";

export const deriveAnalyticsPageType = (pathname: string): AnalyticsPageType => {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/products/")) return "product";
  if (
    pathname === "/products" ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/bestseller") ||
    pathname.startsWith("/neuheiten") ||
    pathname.startsWith("/(seo)")
  ) {
    return "category";
  }
  if (pathname.startsWith("/cart")) return "cart";
  if (pathname.startsWith("/checkout") || pathname.startsWith("/order/success")) {
    return "checkout";
  }
  if (pathname.startsWith("/account") || pathname.startsWith("/order/view")) {
    return "account";
  }
  if (pathname.startsWith("/auth")) return "auth";
  if (pathname.startsWith("/wishlist")) return "wishlist";
  if (
    pathname.startsWith("/blog") ||
    pathname.startsWith("/pages") ||
    pathname.startsWith("/maintenance")
  ) {
    return "content";
  }
  if (pathname.startsWith("/customizer") || pathname.startsWith("/pflanzen-analyzer")) {
    return "utility";
  }
  return "other";
};

export const isTrackedAnalyticsPath = (pathname: string) => !pathname.startsWith("/admin");
