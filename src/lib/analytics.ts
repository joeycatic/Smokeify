"use client";

import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_IDLE_TIMEOUT_MS,
  ANALYTICS_SESSION_STORAGE_KEY,
  deriveAnalyticsPageType,
} from "@/lib/analyticsShared";

type AnalyticsSessionState = {
  id: string;
  startedAt: number;
  lastSeenAt: number;
  storefront: "MAIN";
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

type AnalyticsEventPayload = {
  sessionId: string;
  storefront: "MAIN";
  eventName: string;
  pagePath?: string;
  pageType?: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  currency?: string;
  valueCents?: number;
  quantity?: number;
  productId?: string | null;
  variantId?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown>;
};

const ANALYTICS_STOREFRONT = "MAIN" as const;

const readCookieValue = (key: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]+)`));
  return match?.[1] ?? null;
};

const trimTrackingValue = (value: string | null, maxLength: number) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
};

const readStatus = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const fromCookie = readCookieValue(key);
  if (fromCookie) {
    window.localStorage.setItem(key, fromCookie);
  }
  return fromCookie;
};

export const canUseAnalytics = (): boolean => {
  const consent = readStatus(ANALYTICS_CONSENT_KEY);
  return consent === "accepted";
};

const mergeAttribution = (
  session: Pick<AnalyticsSessionState, "utmSource" | "utmMedium" | "utmCampaign"> | null,
) => {
  const currentParams = readUtmParams();
  return {
    utmSource: session?.utmSource ?? currentParams.utmSource,
    utmMedium: session?.utmMedium ?? currentParams.utmMedium,
    utmCampaign: session?.utmCampaign ?? currentParams.utmCampaign,
  };
};

const createAnalyticsSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `smokeify-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readUtmParams = () => {
  if (typeof window === "undefined") {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: trimTrackingValue(params.get("utm_source"), 120),
    utmMedium: trimTrackingValue(params.get("utm_medium"), 120),
    utmCampaign: trimTrackingValue(params.get("utm_campaign"), 160),
  };
};

const readAnalyticsSession = (): AnalyticsSessionState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AnalyticsSessionState>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.lastSeenAt !== "number"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      startedAt: parsed.startedAt,
      lastSeenAt: parsed.lastSeenAt,
      storefront: ANALYTICS_STOREFRONT,
      utmSource: trimTrackingValue(
        typeof parsed.utmSource === "string" ? parsed.utmSource : null,
        120,
      ),
      utmMedium: trimTrackingValue(
        typeof parsed.utmMedium === "string" ? parsed.utmMedium : null,
        120,
      ),
      utmCampaign: trimTrackingValue(
        typeof parsed.utmCampaign === "string" ? parsed.utmCampaign : null,
        160,
      ),
    };
  } catch {
    return null;
  }
};

const persistAnalyticsSession = (value: AnalyticsSessionState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

export const getAnalyticsSession = () => {
  const now = Date.now();
  const current = readAnalyticsSession();
  if (current && now - current.lastSeenAt <= ANALYTICS_IDLE_TIMEOUT_MS) {
    const next = {
      ...current,
      lastSeenAt: now,
      ...mergeAttribution(current),
    };
    persistAnalyticsSession(next);
    return next;
  }

  const attribution = mergeAttribution(null);
  const freshSession = {
    id: createAnalyticsSessionId(),
    startedAt: now,
    lastSeenAt: now,
    storefront: ANALYTICS_STOREFRONT,
    ...attribution,
  };
  persistAnalyticsSession(freshSession);
  return freshSession;
};

export const getAnalyticsSessionId = () => getAnalyticsSession().id;

const normalizeValueCents = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(numeric * 100);
};

const normalizeQuantity = (items: unknown) => {
  if (!Array.isArray(items)) return undefined;
  const total = items.reduce((sum, item) => {
    const quantity = Number(
      typeof item === "object" && item !== null && "quantity" in item
        ? (item as { quantity?: unknown }).quantity
        : 0
    );
    if (!Number.isFinite(quantity) || quantity <= 0) return sum;
    return sum + Math.floor(quantity);
  }, 0);
  return total > 0 ? total : undefined;
};

const extractPrimaryItemIds = (items: unknown) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { productId: undefined, variantId: undefined };
  }
  const [first] = items;
  if (!first || typeof first !== "object") {
    return { productId: undefined, variantId: undefined };
  }
  const record = first as Record<string, unknown>;
  const productId =
    typeof record.product_id === "string" ? record.product_id : undefined;
  const variantId =
    typeof record.item_id === "string" ? record.item_id : undefined;
  return { productId, variantId };
};

const buildPayload = (
  eventName: string,
  params?: Record<string, unknown>,
  overrides?: Partial<AnalyticsEventPayload>
): AnalyticsEventPayload | null => {
  if (typeof window === "undefined") return null;

  const session = getAnalyticsSession();
  const sessionId = session.id;
  const pagePath = overrides?.pagePath ?? window.location.pathname;
  const pageType = overrides?.pageType ?? deriveAnalyticsPageType(pagePath);
  const ids = extractPrimaryItemIds(params?.items);

  return {
    sessionId,
    storefront: ANALYTICS_STOREFRONT,
    eventName,
    pagePath,
    pageType,
    referrer: document.referrer || null,
    utmSource: overrides?.utmSource ?? session.utmSource,
    utmMedium: overrides?.utmMedium ?? session.utmMedium,
    utmCampaign: overrides?.utmCampaign ?? session.utmCampaign,
    currency: typeof params?.currency === "string" ? params.currency : undefined,
    valueCents:
      typeof overrides?.valueCents === "number"
        ? overrides.valueCents
        : normalizeValueCents(params?.value),
    quantity: normalizeQuantity(params?.items),
    productId: overrides?.productId ?? ids.productId,
    variantId: overrides?.variantId ?? ids.variantId,
    orderId:
      typeof overrides?.orderId === "string"
        ? overrides.orderId
        : typeof params?.order_id === "string"
        ? params.order_id
        : typeof params?.transaction_id === "string"
        ? params.transaction_id
        : undefined,
    metadata: params,
  };
};

const postAnalyticsPayload = (payload: AnalyticsEventPayload) => {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon("/api/analytics/events", blob);
    if (sent) return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore analytics transport failures.
  });
};

export const trackAnalyticsEvent = (
  eventName: string,
  params?: Record<string, unknown>
) => {
  if (typeof window === "undefined") return;
  if (!canUseAnalytics()) return;
  const dataLayer = (window as { dataLayer?: Array<Record<string, unknown>> })
    .dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event: eventName, ...(params ?? {}) });
  }
  const payload = buildPayload(eventName, params);
  if (payload) {
    postAnalyticsPayload(payload);
  }
};

export const trackFirstPartyAnalyticsEvent = (
  eventName: string,
  params?: Record<string, unknown>
) => {
  if (typeof window === "undefined") return;
  if (!canUseAnalytics()) return;
  const payload = buildPayload(eventName, params);
  if (payload) {
    postAnalyticsPayload(payload);
  }
};

export const trackAnalyticsPageView = (pathname: string) => {
  if (typeof window === "undefined" || !canUseAnalytics()) return;
  const payload = buildPayload("page_view", undefined, {
    pagePath: pathname,
    pageType: deriveAnalyticsPageType(pathname),
  });
  if (payload) {
    postAnalyticsPayload(payload);
  }
};

export const trackAnalyticsHeartbeat = (pathname: string) => {
  if (typeof window === "undefined" || !canUseAnalytics()) return;
  const payload = buildPayload("session_heartbeat", undefined, {
    pagePath: pathname,
    pageType: deriveAnalyticsPageType(pathname),
  });
  if (payload) {
    postAnalyticsPayload(payload);
  }
};
