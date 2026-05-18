export const ANALYTICS_CONSENT_KEY = "smokeify_cookie_consent";
export const ANALYTICS_SESSION_STORAGE_KEY = "smokeify_analytics_session_v1";
export const ANALYTICS_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ANALYTICS_HEARTBEAT_INTERVAL_MS = 30 * 1000;
export const ACTIVE_ANALYTICS_WINDOW_MINUTES = 5;

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
