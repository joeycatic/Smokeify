import { getServerSession } from "next-auth";
import { Prisma, type Storefront } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/requestSecurity";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { hasJsonContentType, jsonApi } from "@/lib/apiRoute";

type AnalyticsIngestBody = {
  sessionId?: unknown;
  storefront?: unknown;
  eventName?: unknown;
  pagePath?: unknown;
  pageType?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  currency?: unknown;
  valueCents?: unknown;
  quantity?: unknown;
  productId?: unknown;
  variantId?: unknown;
  orderId?: unknown;
  metadata?: unknown;
};

const trimString = (value: unknown, maxLength = 255) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const STOREFRONTS = new Set<Storefront>(["MAIN", "GROW"]);

const normalizeStorefront = (value: unknown): Storefront | undefined => {
  const storefront = trimString(value, 12)?.toUpperCase();
  if (!storefront || !STOREFRONTS.has(storefront as Storefront)) {
    return undefined;
  }
  return storefront as Storefront;
};

const normalizePath = (value: unknown) => {
  const path = trimString(value, 500);
  if (!path) return undefined;
  return path.startsWith("/") ? path : `/${path}`;
};

const normalizeInteger = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(numeric);
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const stringified = JSON.stringify(value);
    if (stringified.length > 8_000) return undefined;
    return value as Prisma.InputJsonArray;
  }
  if (value && typeof value === "object") {
    const stringified = JSON.stringify(value);
    if (stringified.length > 8_000) return undefined;
    return value as Prisma.InputJsonObject;
  }
  return undefined;
};

const getDeviceType = (userAgent: string | null) => {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "unknown";
  if (/(ipad|tablet)/.test(ua)) return "tablet";
  if (/(mobi|iphone|android)/.test(ua)) return "mobile";
  return "desktop";
};

const normalizeBody = (body: unknown) => {
  if (Array.isArray(body)) {
    return body.slice(0, 20) as AnalyticsIngestBody[];
  }
  return body ? [body as AnalyticsIngestBody] : [];
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonApi({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasJsonContentType(request)) {
    return jsonApi({ error: "Expected application/json" }, { status: 415 });
  }

  const ip = getClientIp(request.headers);
  const limit = 300;
  const rateLimit = await checkRateLimit({
    key: `analytics-events:${ip}`,
    limit,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return jsonApi(
      { error: "Too many requests" },
      { status: 429 },
      { rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt } },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const payloads = normalizeBody(rawBody);
  if (payloads.length === 0) {
    return jsonApi(
      { error: "Invalid payload" },
      { status: 400 },
      { rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt } },
    );
  }
  const now = new Date();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? undefined;
  const deviceType = getDeviceType(request.headers.get("user-agent"));
  const normalizedPayloads = payloads
    .map((body) => {
      const sessionId = trimString(body.sessionId, 120);
      const storefront = normalizeStorefront(body.storefront);
      const eventName = trimString(body.eventName, 80);
      if (!sessionId || !eventName) {
        return null;
      }

      return {
        sessionId,
        storefront,
        eventName,
        pagePath: normalizePath(body.pagePath),
        pageType: trimString(body.pageType, 50),
        referrer: trimString(body.referrer, 500),
        utmSource: trimString(body.utmSource, 120),
        utmMedium: trimString(body.utmMedium, 120),
        utmCampaign: trimString(body.utmCampaign, 160),
        currency: trimString(body.currency, 12),
        valueCents: normalizeInteger(body.valueCents),
        quantity: normalizeInteger(body.quantity),
        productId: trimString(body.productId, 120),
        variantId: trimString(body.variantId, 120),
        orderId: trimString(body.orderId, 120),
        metadata: toJsonValue(body.metadata),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (normalizedPayloads.length === 0) {
    return jsonApi(
      { error: "sessionId and eventName are required" },
      { status: 400 },
      { rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt } },
    );
  }

  const sessionRows = Array.from(
    new Map(normalizedPayloads.map((entry) => [entry.sessionId, entry])).values(),
  );
  const eventRows = normalizedPayloads
    .filter((entry) => entry.eventName !== "session_heartbeat")
    .map((entry) => ({
      ...entry,
      userId,
    }));

  await prisma.$transaction([
    ...sessionRows.map((entry) =>
      prisma.analyticsSession.upsert({
        where: { id: entry.sessionId },
        create: {
          id: entry.sessionId,
          userId,
          storefront: entry.storefront,
          firstPath: entry.pagePath,
          lastPath: entry.pagePath,
          firstPageType: entry.pageType,
          lastPageType: entry.pageType,
          firstReferrer: entry.referrer,
          utmSource: entry.utmSource,
          utmMedium: entry.utmMedium,
          utmCampaign: entry.utmCampaign,
          deviceType,
          startedAt: now,
          lastSeenAt: now,
        },
        update: {
          lastSeenAt: now,
          lastPath: entry.pagePath,
          lastPageType: entry.pageType,
          deviceType,
          ...(userId ? { userId } : {}),
          ...(entry.storefront ? { storefront: entry.storefront } : {}),
        },
      }),
    ),
    ...(eventRows.length > 0
      ? [
          prisma.analyticsEvent.createMany({
            data: eventRows,
          }),
        ]
      : []),
  ]);

  return jsonApi(
    {
      ok: true,
      ingested: eventRows.length,
    },
    undefined,
    { rateLimit: { limit, remaining: rateLimit.remaining, resetAt: rateLimit.resetAt } },
  );
}
