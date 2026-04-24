import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, type Storefront } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/requestSecurity";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

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

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const rateLimit = await checkRateLimit({
    key: `analytics-events:${ip}`,
    limit: 300,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as AnalyticsIngestBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sessionId = trimString(body.sessionId, 120);
  const storefront = normalizeStorefront(body.storefront);
  const eventName = trimString(body.eventName, 80);
  if (!sessionId || !eventName) {
    return NextResponse.json({ error: "sessionId and eventName are required" }, { status: 400 });
  }

  const pagePath = normalizePath(body.pagePath);
  const pageType = trimString(body.pageType, 50);
  const referrer = trimString(body.referrer, 500);
  const utmSource = trimString(body.utmSource, 120);
  const utmMedium = trimString(body.utmMedium, 120);
  const utmCampaign = trimString(body.utmCampaign, 160);
  const currency = trimString(body.currency, 12);
  const valueCents = normalizeInteger(body.valueCents);
  const quantity = normalizeInteger(body.quantity);
  const productId = trimString(body.productId, 120);
  const variantId = trimString(body.variantId, 120);
  const orderId = trimString(body.orderId, 120);
  const metadata = toJsonValue(body.metadata);
  const now = new Date();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? undefined;
  const deviceType = getDeviceType(request.headers.get("user-agent"));
  const isHeartbeat = eventName === "session_heartbeat";

  await prisma.analyticsSession.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      userId,
      storefront,
      firstPath: pagePath,
      lastPath: pagePath,
      firstPageType: pageType,
      lastPageType: pageType,
      firstReferrer: referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      deviceType,
      startedAt: now,
      lastSeenAt: now,
    },
    update: {
      lastSeenAt: now,
      lastPath: pagePath,
      lastPageType: pageType,
      deviceType,
      ...(userId ? { userId } : {}),
      ...(storefront ? { storefront } : {}),
    },
  });

  if (!isHeartbeat) {
    await prisma.analyticsEvent.create({
      data: {
        sessionId,
        userId,
        storefront,
        eventName,
        pagePath,
        pageType,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        currency,
        valueCents,
        quantity,
        productId,
        variantId,
        orderId,
        metadata,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
