import "server-only";

import nodemailer from "nodemailer";
import { Prisma, type MarketingCampaignStatus, type MarketingStorefrontScope } from "@prisma/client";
import type { Session } from "next-auth";
import { buildCustomerSegments, type CustomerSegment } from "@/lib/adminCustomers";
import { PAID_ORDER_STATUSES } from "@/lib/adminInsights";
import { logAdminAction } from "@/lib/adminAuditLog";
import { getNewsletterAudienceSummary } from "@/lib/adminNewsletter";
import { buildNewsletterCampaignEmail } from "@/lib/newsletterEmail";
import { prisma } from "@/lib/prisma";
import { sendResendEmail } from "@/lib/resend";
import { getStorefrontOrigin } from "@/lib/storefrontEmailBrand";
import {
  parseAdminStorefrontScope,
  parseStorefront,
  STOREFRONTS,
  type AdminStorefrontScope,
  type StorefrontCode,
} from "@/lib/storefronts";
import { getGrowthOverviewSafe } from "@/lib/growthService";
import { canAdminPerformAction, hasAdminScope, type AdminRole } from "@/lib/adminPermissions";

export const MCC_RANGE_OPTIONS = [7, 30, 90, 365] as const;
export type MccRangeDays = (typeof MCC_RANGE_OPTIONS)[number];
export type MarketingScope = AdminStorefrontScope;

type ContactSignal = "registered" | "guest" | "subscriber" | "back_in_stock" | "checkout_recovery" | "analyzer";
type NewsletterConsentFilter = "any" | "opted_in" | "not_opted_in";

export type MccAudienceFilters = {
  q?: string;
  contactTypes?: Array<"registered" | "guest" | "subscriber">;
  newsletterConsent?: NewsletterConsentFilter;
  minOrders?: number;
  maxOrders?: number;
  minRevenueCents?: number;
  maxRevenueCents?: number;
  lastOrderWithinDays?: number;
  segments?: CustomerSegment[];
  hasBackInStockIntent?: boolean;
  hasCheckoutRecovery?: boolean;
  hasAnalyzerActivity?: boolean;
  supportRisk?: boolean;
};

export type MccContact = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  type: "registered" | "guest" | "subscriber";
  storefrontAffinity: StorefrontCode | null;
  storefronts: StorefrontCode[];
  lifecycleStage: string;
  consentStatus: "OPTED_IN" | "OPTED_OUT" | "UNKNOWN";
  source: string;
  signals: ContactSignal[];
  orderCount: number;
  totalRevenueCents: number;
  refundedCents: number;
  averageOrderCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  discountOrderCount: number;
  returnCount: number;
  openSupportCases: number;
  backInStockRequests: number;
  checkoutRecoverySessions: number;
  analyzerRuns: number;
  segments: CustomerSegment[];
  tags: string[];
  lastActivityAt: string | null;
};

export type MccOverviewPayload = {
  scope: MarketingScope;
  rangeDays: MccRangeDays;
  generatedAt: string;
  metrics: {
    revenueInfluencedCents: number;
    activeAudienceSize: number;
    newsletterCoverageRate: number;
    newsletterRecipients: number;
    campaignSends: number;
    activeCampaigns: number;
    automationHealthRate: number;
    activeAutomations: number;
    openCrmTasks: number;
    openSupportCases: number;
  };
  split: Record<StorefrontCode, { contacts: number; revenueCents: number; orders: number }>;
  lifecycle: Array<{ stage: string; count: number }>;
  funnel: Array<{ label: string; value: number }>;
  topAudiences: Array<{
    id: string;
    name: string;
    storefrontScope: MarketingScope;
    computedCount: number;
    updatedAt: string;
  }>;
  activeCampaigns: Array<{
    id: string;
    name: string;
    status: MarketingCampaignStatus;
    storefrontScope: MarketingScope;
    audienceName: string | null;
    sentCount: number;
    updatedAt: string;
  }>;
  openTasks: Array<{
    id: string;
    customerId: string;
    title: string;
    status: string;
    dueAt: string | null;
    updatedAt: string;
  }>;
};

export type MccAudiencePayload = {
  id: string;
  name: string;
  description: string | null;
  storefrontScope: MarketingScope;
  filters: MccAudienceFilters;
  computedCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type MccCampaignPayload = {
  id: string;
  name: string;
  channel: string;
  storefrontScope: MarketingScope;
  audienceId: string | null;
  audienceName: string | null;
  status: MarketingCampaignStatus;
  subject: string | null;
  body: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  attemptedCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MccAutomationPayload = {
  id: string;
  key: string;
  name: string;
  type: string;
  storefrontScope: MarketingScope;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "FAILED";
  config: Prisma.JsonValue;
  metrics: Prisma.JsonValue | null;
  updatedAt: string;
};

export type MccActivityPayload = {
  id: string;
  contactProfileId: string | null;
  campaignId: string | null;
  audienceId: string | null;
  storefrontScope: MarketingScope;
  storefront: StorefrontCode | null;
  activityType: string;
  title: string;
  summary: string | null;
  dueAt: string | null;
  completedAt: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type MccPagePayload = {
  overview: MccOverviewPayload;
  contacts: {
    contacts: MccContact[];
    totalCount: number;
  };
  audiences: MccAudiencePayload[];
  campaigns: MccCampaignPayload[];
  automations: MccAutomationPayload[];
  activities: MccActivityPayload[];
  capabilities: {
    canWriteMarketing: boolean;
    canSendMarketing: boolean;
    canManageAutomations: boolean;
    canWriteCrm: boolean;
  };
};

type MutableContact = Omit<
  MccContact,
  | "id"
  | "storefronts"
  | "signals"
  | "segments"
  | "firstOrderAt"
  | "lastOrderAt"
  | "lastActivityAt"
> & {
  signals: Set<ContactSignal>;
  storefronts: Set<StorefrontCode>;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  lastActivityAt: Date | null;
  discountOrderCount: number;
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const toIso = (value?: Date | null) => value?.toISOString() ?? null;

const nowMinusDays = (days: number) =>
  new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);

export function parseMccRange(value?: string | string[] | null): MccRangeDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return MCC_RANGE_OPTIONS.includes(parsed as MccRangeDays)
    ? (parsed as MccRangeDays)
    : 30;
}

export function parseMccScope(value?: string | string[] | null): MarketingScope {
  return parseAdminStorefrontScope(value);
}

const scopeIncludesStorefront = (
  scope: MarketingScope,
  storefront?: StorefrontCode | string | null,
) => scope === "ALL" || storefront === scope;

const scopeToMarketingWhere = (scope: MarketingScope) =>
  scope === "ALL"
    ? {}
    : { storefrontScope: { in: ["ALL", scope] as MarketingStorefrontScope[] } };

const safeJsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asInt = (value: unknown, min = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(min, Math.trunc(numeric));
};

export function parseMccAudienceFilters(value: unknown): MccAudienceFilters {
  const raw = safeJsonObject(value);
  const contactTypes = Array.isArray(raw.contactTypes)
    ? raw.contactTypes.filter(
        (entry): entry is "registered" | "guest" | "subscriber" =>
          entry === "registered" || entry === "guest" || entry === "subscriber",
      )
    : undefined;
  const newsletterConsent =
    raw.newsletterConsent === "opted_in" || raw.newsletterConsent === "not_opted_in"
      ? raw.newsletterConsent
      : "any";
  const segments = Array.isArray(raw.segments)
    ? raw.segments.filter(
        (entry): entry is CustomerSegment =>
          entry === "new" ||
          entry === "repeat" ||
          entry === "high_value" ||
          entry === "churn_risk" ||
          entry === "discount_driven" ||
          entry === "return_risk" ||
          entry === "vip",
      )
    : undefined;

  return {
    q: typeof raw.q === "string" ? raw.q.trim().slice(0, 120) : undefined,
    contactTypes: contactTypes && contactTypes.length > 0 ? contactTypes : undefined,
    newsletterConsent,
    minOrders: asInt(raw.minOrders),
    maxOrders: asInt(raw.maxOrders),
    minRevenueCents: asInt(raw.minRevenueCents),
    maxRevenueCents: asInt(raw.maxRevenueCents),
    lastOrderWithinDays: asInt(raw.lastOrderWithinDays, 1),
    segments: segments && segments.length > 0 ? segments : undefined,
    hasBackInStockIntent:
      typeof raw.hasBackInStockIntent === "boolean" ? raw.hasBackInStockIntent : undefined,
    hasCheckoutRecovery:
      typeof raw.hasCheckoutRecovery === "boolean" ? raw.hasCheckoutRecovery : undefined,
    hasAnalyzerActivity:
      typeof raw.hasAnalyzerActivity === "boolean" ? raw.hasAnalyzerActivity : undefined,
    supportRisk: typeof raw.supportRisk === "boolean" ? raw.supportRisk : undefined,
  };
}

export function contactMatchesAudienceFilters(
  contact: MccContact,
  filters: MccAudienceFilters,
  now = new Date(),
) {
  const query = filters.q?.trim().toLowerCase();
  if (query) {
    const haystack = [
      contact.email,
      contact.name ?? "",
      contact.type,
      contact.lifecycleStage,
      contact.consentStatus,
      ...contact.signals,
      ...contact.segments,
      ...contact.tags,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.contactTypes?.length && !filters.contactTypes.includes(contact.type)) return false;
  if (filters.newsletterConsent === "opted_in" && contact.consentStatus !== "OPTED_IN") {
    return false;
  }
  if (filters.newsletterConsent === "not_opted_in" && contact.consentStatus === "OPTED_IN") {
    return false;
  }
  if (typeof filters.minOrders === "number" && contact.orderCount < filters.minOrders) {
    return false;
  }
  if (typeof filters.maxOrders === "number" && contact.orderCount > filters.maxOrders) {
    return false;
  }
  if (
    typeof filters.minRevenueCents === "number" &&
    contact.totalRevenueCents < filters.minRevenueCents
  ) {
    return false;
  }
  if (
    typeof filters.maxRevenueCents === "number" &&
    contact.totalRevenueCents > filters.maxRevenueCents
  ) {
    return false;
  }
  if (typeof filters.lastOrderWithinDays === "number") {
    if (!contact.lastOrderAt) return false;
    const cutoff = new Date(
      now.getTime() - filters.lastOrderWithinDays * 24 * 60 * 60 * 1000,
    );
    if (new Date(contact.lastOrderAt) < cutoff) return false;
  }
  if (
    filters.segments?.length &&
    !filters.segments.some((segment) => contact.segments.includes(segment))
  ) {
    return false;
  }
  if (
    typeof filters.hasBackInStockIntent === "boolean" &&
    (contact.backInStockRequests > 0) !== filters.hasBackInStockIntent
  ) {
    return false;
  }
  if (
    typeof filters.hasCheckoutRecovery === "boolean" &&
    (contact.checkoutRecoverySessions > 0) !== filters.hasCheckoutRecovery
  ) {
    return false;
  }
  if (
    typeof filters.hasAnalyzerActivity === "boolean" &&
    (contact.analyzerRuns > 0) !== filters.hasAnalyzerActivity
  ) {
    return false;
  }
  if (
    typeof filters.supportRisk === "boolean" &&
    (contact.openSupportCases > 0 || contact.returnCount > 0) !== filters.supportRisk
  ) {
    return false;
  }
  return true;
}

const createContact = (email: string): MutableContact => ({
  userId: null,
  email,
  name: null,
  type: "subscriber",
  storefrontAffinity: null,
  consentStatus: "UNKNOWN",
  lifecycleStage: "UNKNOWN",
  source: "imported",
  signals: new Set(),
  storefronts: new Set(),
  orderCount: 0,
  totalRevenueCents: 0,
  refundedCents: 0,
  averageOrderCents: 0,
  firstOrderAt: null,
  lastOrderAt: null,
  discountOrderCount: 0,
  returnCount: 0,
  openSupportCases: 0,
  backInStockRequests: 0,
  checkoutRecoverySessions: 0,
  analyzerRuns: 0,
  tags: [],
  lastActivityAt: null,
});

const touchContact = (contact: MutableContact, date?: Date | null) => {
  if (!date) return;
  if (!contact.lastActivityAt || date > contact.lastActivityAt) {
    contact.lastActivityAt = date;
  }
};

const chooseAffinity = (storefronts: Set<StorefrontCode>, fallback?: StorefrontCode | null) => {
  if (fallback) return fallback;
  if (storefronts.has("GROW") && !storefronts.has("MAIN")) return "GROW";
  if (storefronts.has("MAIN") && !storefronts.has("GROW")) return "MAIN";
  return null;
};

const finalizeContact = (key: string, contact: MutableContact): MccContact => {
  const firstOrderAt = contact.firstOrderAt;
  const lastOrderAt = contact.lastOrderAt;
  const segments = buildCustomerSegments({
    firstOrderAt,
    lastOrderAt,
    orderCount: contact.orderCount,
    totalSpentCents: contact.totalRevenueCents + contact.refundedCents,
    discountOrderCount: contact.discountOrderCount,
    returnCount: contact.returnCount,
  });
  const lifecycleStage =
    contact.orderCount === 0
      ? contact.checkoutRecoverySessions > 0
        ? "ABANDONED_CHECKOUT"
        : "PROSPECT"
      : segments.includes("churn_risk")
        ? "AT_RISK"
        : contact.orderCount > 1
          ? "REPEAT"
          : "CUSTOMER";

  return {
    ...contact,
    id: contact.userId ?? `email:${key}`,
    storefrontAffinity: chooseAffinity(contact.storefronts, contact.storefrontAffinity),
    storefronts: Array.from(contact.storefronts.values()).sort(),
    lifecycleStage,
    signals: Array.from(contact.signals.values()).sort(),
    segments,
    firstOrderAt: toIso(firstOrderAt),
    lastOrderAt: toIso(lastOrderAt),
    lastActivityAt: toIso(contact.lastActivityAt ?? lastOrderAt ?? firstOrderAt),
  };
};

export async function loadMccContacts(input: {
  storefront?: string | null;
  q?: string | null;
  limit?: number;
} = {}) {
  const scope = parseMccScope(input.storefront);
  const limit = Math.max(1, Math.min(500, input.limit ?? 80));
  const contacts = new Map<string, MutableContact>();

  const get = (email: string) => {
    const key = normalizeEmail(email);
    if (!key) return null;
    const current = contacts.get(key) ?? createContact(email.trim());
    contacts.set(key, current);
    return current;
  };

  const [users, guestOrders, subscribers, backInStock, checkoutRecovery, supportCases] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: "USER", email: { not: null } },
        select: {
          id: true,
          email: true,
          name: true,
          registeredStorefront: true,
          newsletterOptIn: true,
          customerGroup: true,
          crmFlags: true,
          createdAt: true,
          orders: {
            where: {
              paymentStatus: { in: PAID_ORDER_STATUSES },
              ...(scope === "ALL" ? {} : { sourceStorefront: scope }),
            },
            select: {
              amountTotal: true,
              amountRefunded: true,
              discountCode: true,
              createdAt: true,
              sourceStorefront: true,
            },
          },
          returnRequests: {
            where: scope === "ALL" ? undefined : { order: { sourceStorefront: scope } },
            select: { id: true },
          },
          plantAnalyses: { select: { id: true, createdAt: true }, take: 50 },
        },
        take: 2000,
      }),
      prisma.order.findMany({
        where: {
          userId: null,
          customerEmail: { not: null },
          paymentStatus: { in: PAID_ORDER_STATUSES },
          ...(scope === "ALL" ? {} : { sourceStorefront: scope }),
        },
        select: {
          customerEmail: true,
          shippingName: true,
          amountTotal: true,
          amountRefunded: true,
          discountCode: true,
          createdAt: true,
          sourceStorefront: true,
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.newsletterSubscriber.findMany({
        select: { email: true, userId: true, source: true, unsubscribedAt: true, subscribedAt: true },
        orderBy: { subscribedAt: "desc" },
        take: 2000,
      }),
      prisma.backInStockRequest.findMany({
        where: {
          ...(scope === "ALL" ? {} : { storefront: scope }),
        },
        select: { email: true, storefront: true, createdAt: true, notifiedAt: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.checkoutRecoverySession.findMany({
        where: {
          customerEmail: { not: null },
          ...(scope === "ALL" ? {} : { sourceStorefront: scope }),
        },
        select: {
          customerEmail: true,
          customerFirstName: true,
          customerLastName: true,
          userId: true,
          consentGranted: true,
          sourceStorefront: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.supportCase.findMany({
        where: {
          status: { in: ["OPEN", "WAITING_CUSTOMER", "IN_PROGRESS"] },
        },
        select: {
          linkedCustomerId: true,
          linkedCustomer: { select: { email: true } },
          linkedOrder: { select: { customerEmail: true, sourceStorefront: true } },
          updatedAt: true,
        },
        take: 1000,
      }),
    ]);

  for (const user of users) {
    if (!user.email) continue;
    const contact = get(user.email);
    if (!contact) continue;
    contact.userId = user.id;
    contact.name = user.name;
    contact.type = "registered";
    contact.source = "registered";
    contact.signals.add("registered");
    contact.consentStatus = user.newsletterOptIn ? "OPTED_IN" : "OPTED_OUT";
    if (parseStorefront(user.registeredStorefront)) {
      contact.storefrontAffinity = user.registeredStorefront as StorefrontCode;
      contact.storefronts.add(user.registeredStorefront as StorefrontCode);
    }
    contact.tags = Array.from(new Set([...contact.tags, ...user.crmFlags]));
    touchContact(contact, user.createdAt);
    for (const order of user.orders) {
      contact.orderCount += 1;
      contact.totalRevenueCents += order.amountTotal - order.amountRefunded;
      contact.refundedCents += order.amountRefunded;
      if (order.discountCode) contact.discountOrderCount += 1;
      if (!contact.firstOrderAt || order.createdAt < contact.firstOrderAt) {
        contact.firstOrderAt = order.createdAt;
      }
      if (!contact.lastOrderAt || order.createdAt > contact.lastOrderAt) {
        contact.lastOrderAt = order.createdAt;
      }
      const storefront = parseStorefront(order.sourceStorefront);
      if (storefront) contact.storefronts.add(storefront);
      touchContact(contact, order.createdAt);
    }
    contact.returnCount += user.returnRequests.length;
    contact.analyzerRuns += user.plantAnalyses.length;
    if (user.plantAnalyses.length > 0) contact.signals.add("analyzer");
    for (const run of user.plantAnalyses) touchContact(contact, run.createdAt);
  }

  for (const order of guestOrders) {
    if (!order.customerEmail) continue;
    const contact = get(order.customerEmail);
    if (!contact) continue;
    if (contact.type !== "registered") contact.type = "guest";
    contact.name ||= order.shippingName;
    contact.source = contact.source === "imported" ? "guest_order" : contact.source;
    contact.signals.add("guest");
    contact.orderCount += 1;
    contact.totalRevenueCents += order.amountTotal - order.amountRefunded;
    contact.refundedCents += order.amountRefunded;
    if (order.discountCode) contact.discountOrderCount += 1;
    if (!contact.firstOrderAt || order.createdAt < contact.firstOrderAt) {
      contact.firstOrderAt = order.createdAt;
    }
    if (!contact.lastOrderAt || order.createdAt > contact.lastOrderAt) {
      contact.lastOrderAt = order.createdAt;
    }
    const storefront = parseStorefront(order.sourceStorefront);
    if (storefront) contact.storefronts.add(storefront);
    touchContact(contact, order.createdAt);
  }

  for (const subscriber of subscribers) {
    const contact = get(subscriber.email);
    if (!contact) continue;
    contact.signals.add("subscriber");
    contact.source =
      contact.source === "imported" ? `newsletter:${subscriber.source ?? "UNKNOWN"}` : contact.source;
    if (contact.consentStatus === "UNKNOWN") {
      contact.consentStatus = subscriber.unsubscribedAt ? "OPTED_OUT" : "OPTED_IN";
    }
    touchContact(contact, subscriber.subscribedAt);
  }

  for (const request of backInStock) {
    const contact = get(request.email);
    if (!contact) continue;
    contact.signals.add("back_in_stock");
    contact.backInStockRequests += request.notifiedAt ? 0 : 1;
    const storefront = parseStorefront(request.storefront);
    if (storefront) contact.storefronts.add(storefront);
    touchContact(contact, request.createdAt);
  }

  for (const session of checkoutRecovery) {
    if (!session.customerEmail) continue;
    const contact = get(session.customerEmail);
    if (!contact) continue;
    contact.signals.add("checkout_recovery");
    contact.checkoutRecoverySessions += session.completedAt ? 0 : 1;
    contact.userId ||= session.userId;
    contact.name ||= [session.customerFirstName, session.customerLastName].filter(Boolean).join(" ") || null;
    if (contact.consentStatus === "UNKNOWN" && session.consentGranted) {
      contact.consentStatus = "OPTED_IN";
    }
    const storefront = parseStorefront(session.sourceStorefront);
    if (storefront) contact.storefronts.add(storefront);
    touchContact(contact, session.createdAt);
  }

  for (const supportCase of supportCases) {
    const email = supportCase.linkedCustomer?.email ?? supportCase.linkedOrder?.customerEmail;
    if (!email) continue;
    const storefront = parseStorefront(supportCase.linkedOrder?.sourceStorefront);
    if (!scopeIncludesStorefront(scope, storefront)) continue;
    const contact = get(email);
    if (!contact) continue;
    contact.openSupportCases += 1;
    if (storefront) contact.storefronts.add(storefront);
    touchContact(contact, supportCase.updatedAt);
  }

  const query = input.q?.trim().toLowerCase();
  const finalized = Array.from(contacts.entries())
    .map(([key, contact]) => {
      contact.averageOrderCents =
        contact.orderCount > 0 ? Math.round(contact.totalRevenueCents / contact.orderCount) : 0;
      return finalizeContact(key, contact);
    })
    .filter((contact) => {
      if (scope !== "ALL" && !contact.storefronts.includes(scope)) return false;
      if (!query) return true;
      return contactMatchesAudienceFilters(contact, { q: query });
    })
    .sort((left, right) => {
      const dateDiff =
        new Date(right.lastActivityAt ?? 0).getTime() -
        new Date(left.lastActivityAt ?? 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return right.totalRevenueCents - left.totalRevenueCents;
    });

  return {
    contacts: finalized.slice(0, limit),
    totalCount: finalized.length,
  };
}

export async function previewMccAudience(input: {
  storefront?: string | null;
  filters?: unknown;
}) {
  const scope = parseMccScope(input.storefront);
  const filters = parseMccAudienceFilters(input.filters);
  const { contacts } = await loadMccContacts({ storefront: scope, limit: 500 });
  return contacts.filter((contact) => contactMatchesAudienceFilters(contact, filters));
}

export async function listMccAudiences(scope: MarketingScope): Promise<MccAudiencePayload[]> {
  const audiences = await prisma.marketingAudience.findMany({
    where: scopeToMarketingWhere(scope),
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
  });

  return audiences.map((audience) => ({
    id: audience.id,
    name: audience.name,
    description: audience.description,
    storefrontScope: audience.storefrontScope as MarketingScope,
    filters: parseMccAudienceFilters(audience.filters),
    computedCount: audience.computedCount,
    status: audience.status,
    createdAt: audience.createdAt.toISOString(),
    updatedAt: audience.updatedAt.toISOString(),
  }));
}

export async function createMccAudience(input: {
  name: string;
  description?: string | null;
  storefront?: string | null;
  filters?: unknown;
  actor: Session["user"];
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Audience name is required.");
  const scope = parseMccScope(input.storefront);
  const filters = parseMccAudienceFilters(input.filters);
  const contacts = await previewMccAudience({ storefront: scope, filters });
  const audience = await prisma.marketingAudience.create({
    data: {
      name,
      description: input.description?.trim() || null,
      storefrontScope: scope,
      filters: filters as unknown as Prisma.InputJsonValue,
      computedCount: contacts.length,
      createdById: input.actor.id,
      createdByEmail: input.actor.email ?? null,
    },
  });

  await logAdminAction({
    actor: { id: input.actor.id, email: input.actor.email ?? null },
    action: "marketing.audience.create",
    targetType: "marketing_audience",
    targetId: audience.id,
    summary: `Created MCC audience ${audience.name}`,
    metadata: { storefrontScope: scope, computedCount: contacts.length, filters },
  });

  return audience;
}

export async function listMccCampaigns(scope: MarketingScope): Promise<MccCampaignPayload[]> {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: scopeToMarketingWhere(scope),
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
  });
  const audienceIds = Array.from(
    new Set(campaigns.map((campaign) => campaign.audienceId).filter(Boolean)),
  ) as string[];
  const audiences =
    audienceIds.length > 0
      ? await prisma.marketingAudience.findMany({
          where: { id: { in: audienceIds } },
          select: { id: true, name: true },
        })
      : [];
  const audienceNames = new Map(audiences.map((audience) => [audience.id, audience.name]));
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    storefrontScope: campaign.storefrontScope as MarketingScope,
    audienceId: campaign.audienceId,
    audienceName: campaign.audienceId ? audienceNames.get(campaign.audienceId) ?? null : null,
    status: campaign.status,
    subject: campaign.subject,
    body: campaign.body,
    scheduledAt: toIso(campaign.scheduledAt),
    sentAt: toIso(campaign.sentAt),
    attemptedCount: campaign.attemptedCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  }));
}

export async function createMccCampaignDraft(input: {
  name: string;
  storefront?: string | null;
  audienceId?: string | null;
  subject?: string | null;
  body?: string | null;
  actor: Session["user"];
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Campaign name is required.");
  const subject = input.subject?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  const campaign = await prisma.marketingCampaign.create({
    data: {
      name,
      storefrontScope: parseMccScope(input.storefront),
      audienceId: input.audienceId || null,
      subject: subject || null,
      body: body || null,
      status: subject && body && input.audienceId ? "READY" : "DRAFT",
      createdById: input.actor.id,
      createdByEmail: input.actor.email ?? null,
    },
  });

  await logAdminAction({
    actor: { id: input.actor.id, email: input.actor.email ?? null },
    action: "marketing.campaign.create",
    targetType: "marketing_campaign",
    targetId: campaign.id,
    summary: `Created MCC campaign ${campaign.name}`,
    metadata: { storefrontScope: campaign.storefrontScope, audienceId: campaign.audienceId },
  });

  return campaign;
}

async function sendMarketingEmail(opts: {
  to: string;
  storefront: StorefrontCode;
  subject: string;
  body: string;
}) {
  const email = buildNewsletterCampaignEmail({
    storefront: opts.storefront,
    recipientEmail: opts.to,
    subject: opts.subject,
    body: opts.body,
    fallbackOrigin: getStorefrontOrigin(opts.storefront),
  });

  if (process.env.RESEND_API_KEY) {
    await sendResendEmail({
      to: opts.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return;
  }

  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error("No email transport configured (RESEND_API_KEY or EMAIL_SERVER required)");
  }
  const transporter = nodemailer.createTransport(server);
  await transporter.sendMail({
    to: opts.to,
    from,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

async function getCampaignRecipients(campaignId: string) {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    include: { audience: true },
  });
  if (!campaign) throw new Error("Campaign not found.");
  if (!campaign.audience) throw new Error("Campaign requires a saved audience.");
  const filters = parseMccAudienceFilters(campaign.audience.filters);
  const contacts = await previewMccAudience({
    storefront: campaign.storefrontScope,
    filters,
  });
  return { campaign, contacts };
}

export async function previewMccCampaignRecipients(campaignId: string) {
  const { contacts } = await getCampaignRecipients(campaignId);
  return {
    count: contacts.length,
    recipients: contacts.slice(0, 20).map((contact) => ({
      email: contact.email,
      name: contact.name,
      storefront: contact.storefrontAffinity ?? contact.storefronts[0] ?? "MAIN",
    })),
  };
}

export async function sendMccCampaignTest(input: {
  campaignId: string;
  recipient: string;
  actor: Session["user"];
}) {
  const recipient = normalizeEmail(input.recipient);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Enter a valid test recipient email.");
  }
  const campaign = await prisma.marketingCampaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) throw new Error("Campaign not found.");
  if (!campaign.subject || !campaign.body) {
    throw new Error("Campaign subject and body are required.");
  }
  const storefront =
    campaign.storefrontScope === "GROW" ? "GROW" : campaign.storefrontScope === "MAIN" ? "MAIN" : "MAIN";
  await sendMarketingEmail({
    to: recipient,
    storefront,
    subject: campaign.subject,
    body: campaign.body,
  });
  await prisma.marketingActivity.create({
    data: {
      campaignId: campaign.id,
      storefrontScope: campaign.storefrontScope,
      storefront,
      activityType: "campaign.test_send",
      title: "Test email sent",
      summary: `Sent test email to ${recipient}`,
      actorId: input.actor.id,
      actorEmail: input.actor.email ?? null,
      metadata: { recipient },
    },
  });
  await logAdminAction({
    actor: { id: input.actor.id, email: input.actor.email ?? null },
    action: "marketing.campaign.test_send",
    targetType: "marketing_campaign",
    targetId: campaign.id,
    summary: `Sent MCC campaign test to ${recipient}`,
    metadata: { recipient, storefront },
  });
  return { ok: true, recipient };
}

export async function launchMccCampaign(input: {
  campaignId: string;
  confirm: boolean;
  actor: Session["user"];
}) {
  if (!input.confirm) throw new Error("Campaign send requires explicit confirmation.");
  const { campaign, contacts } = await getCampaignRecipients(input.campaignId);
  if (!campaign.subject || !campaign.body) {
    throw new Error("Campaign subject and body are required.");
  }
  if (contacts.length === 0) throw new Error("Campaign audience has no eligible recipients.");

  await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: { status: "SENDING", attemptedCount: contacts.length },
  });

  let sentCount = 0;
  const failedRecipients: string[] = [];
  for (let index = 0; index < contacts.length; index += 20) {
    const batch = contacts.slice(index, index + 20);
    const results = await Promise.allSettled(
      batch.map((contact) =>
        sendMarketingEmail({
          to: contact.email,
          storefront: contact.storefrontAffinity ?? contact.storefronts[0] ?? "MAIN",
          subject: campaign.subject ?? "",
          body: campaign.body ?? "",
        }),
      ),
    );
    results.forEach((result, batchIndex) => {
      if (result.status === "fulfilled") {
        sentCount += 1;
      } else {
        failedRecipients.push(batch[batchIndex]?.email ?? "unknown");
      }
    });
  }

  const failedCount = failedRecipients.length;
  const status: MarketingCampaignStatus = failedCount > 0 ? "FAILED" : "SENT";
  const updated = await prisma.marketingCampaign.update({
    where: { id: campaign.id },
    data: {
      status,
      sentAt: new Date(),
      sentCount,
      failedCount,
      summary: {
        attemptedCount: contacts.length,
        sentCount,
        failedCount,
        failedRecipients: failedRecipients.slice(0, 50),
      },
    },
  });
  await prisma.marketingActivity.create({
    data: {
      campaignId: campaign.id,
      audienceId: campaign.audienceId,
      storefrontScope: campaign.storefrontScope,
      activityType: "campaign.send",
      title: status === "SENT" ? "Campaign sent" : "Campaign send completed with failures",
      summary: `${sentCount}/${contacts.length} recipients delivered`,
      actorId: input.actor.id,
      actorEmail: input.actor.email ?? null,
      metadata: { failedRecipients: failedRecipients.slice(0, 50) },
    },
  });
  await logAdminAction({
    actor: { id: input.actor.id, email: input.actor.email ?? null },
    action: "marketing.campaign.send",
    targetType: "marketing_campaign",
    targetId: campaign.id,
    summary: `Sent MCC campaign ${campaign.name}`,
    metadata: {
      attemptedCount: contacts.length,
      sentCount,
      failedCount,
      failedRecipients: failedRecipients.slice(0, 25),
    },
  });

  return {
    ok: true,
    status: updated.status,
    attemptedCount: contacts.length,
    sentCount,
    failedCount,
    failedRecipients: failedRecipients.slice(0, 10),
  };
}

export async function listMccAutomations(scope: MarketingScope): Promise<MccAutomationPayload[]> {
  const [flows, growth] = await Promise.all([
    prisma.marketingAutomationFlow.findMany({
      where: scopeToMarketingWhere(scope),
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    }),
    getGrowthOverviewSafe(),
  ]);
  const existingKeys = new Set(flows.map((flow) => flow.key));
  const virtual: MccAutomationPayload[] = [];
  if ((scope === "ALL" || scope === "GROW") && !existingKeys.has("growvault-welcome-series")) {
    virtual.push({
      id: "virtual:growvault-welcome-series",
      key: "growvault-welcome-series",
      name: "GrowVault welcome series",
      type: "WELCOME",
      storefrontScope: "GROW",
      status: growth.config.enabled && growth.config.payload.welcomeEnabled ? "ACTIVE" : "PAUSED",
      config: growth.config.payload as unknown as Prisma.JsonValue,
      metrics: {
        activeWelcome: growth.metrics.activeWelcome,
        welcomeSent: growth.metrics.welcomeSent,
      } as unknown as Prisma.JsonValue,
      updatedAt: new Date().toISOString(),
    });
  }
  if ((scope === "ALL" || scope === "GROW") && !existingKeys.has("growvault-checkout-recovery")) {
    virtual.push({
      id: "virtual:growvault-checkout-recovery",
      key: "growvault-checkout-recovery",
      name: "GrowVault checkout recovery",
      type: "CHECKOUT_RECOVERY",
      storefrontScope: "GROW",
      status: growth.config.enabled && growth.config.payload.recoveryEnabled ? "ACTIVE" : "PAUSED",
      config: growth.config.payload as unknown as Prisma.JsonValue,
      metrics: {
        pendingBackInStock: growth.metrics.pendingBackInStock,
      } as unknown as Prisma.JsonValue,
      updatedAt: new Date().toISOString(),
    });
  }

  return [
    ...flows.map((flow) => ({
      id: flow.id,
      key: flow.key,
      name: flow.name,
      type: flow.type,
      storefrontScope: flow.storefrontScope as MarketingScope,
      status: flow.status,
      config: flow.config,
      metrics: flow.metrics,
      updatedAt: flow.updatedAt.toISOString(),
    })),
    ...virtual,
  ];
}

export async function upsertMccAutomation(input: {
  key: string;
  name: string;
  type: string;
  storefront?: string | null;
  status?: string | null;
  config?: unknown;
  actor: Session["user"];
}) {
  const key = input.key.trim().toLowerCase();
  const name = input.name.trim();
  if (!key || !name) throw new Error("Automation key and name are required.");
  const status =
    input.status === "ACTIVE" || input.status === "PAUSED" || input.status === "FAILED"
      ? input.status
      : "DRAFT";
  const flow = await prisma.marketingAutomationFlow.upsert({
    where: { key },
    create: {
      key,
      name,
      type: input.type.trim().toUpperCase() || "CUSTOM",
      storefrontScope: parseMccScope(input.storefront),
      status,
      config: (input.config ?? {}) as Prisma.InputJsonValue,
      createdById: input.actor.id,
      createdByEmail: input.actor.email ?? null,
    },
    update: {
      name,
      type: input.type.trim().toUpperCase() || "CUSTOM",
      storefrontScope: parseMccScope(input.storefront),
      status,
      config: (input.config ?? {}) as Prisma.InputJsonValue,
    },
  });

  await logAdminAction({
    actor: { id: input.actor.id, email: input.actor.email ?? null },
    action: "marketing.automation.upsert",
    targetType: "marketing_automation",
    targetId: flow.id,
    summary: `Saved MCC automation ${flow.name}`,
    metadata: { key, status, storefrontScope: flow.storefrontScope },
  });
  return flow;
}

export async function listMccActivities(input: {
  storefront?: string | null;
  campaignId?: string | null;
  audienceId?: string | null;
  contactProfileId?: string | null;
}) {
  const scope = parseMccScope(input.storefront);
  const activities = await prisma.marketingActivity.findMany({
    where: {
      ...scopeToMarketingWhere(scope),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.audienceId ? { audienceId: input.audienceId } : {}),
      ...(input.contactProfileId ? { contactProfileId: input.contactProfileId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return activities.map((activity) => ({
    id: activity.id,
    contactProfileId: activity.contactProfileId,
    campaignId: activity.campaignId,
    audienceId: activity.audienceId,
    storefrontScope: activity.storefrontScope as MarketingScope,
    storefront: parseStorefront(activity.storefront),
    activityType: activity.activityType,
    title: activity.title,
    summary: activity.summary,
    dueAt: toIso(activity.dueAt),
    completedAt: toIso(activity.completedAt),
    actorEmail: activity.actorEmail,
    createdAt: activity.createdAt.toISOString(),
  }));
}

export async function createMccActivity(input: {
  storefront?: string | null;
  contactProfileId?: string | null;
  campaignId?: string | null;
  audienceId?: string | null;
  activityType?: string | null;
  title: string;
  summary?: string | null;
  dueAt?: string | null;
  actor: Session["user"];
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Activity title is required.");
  const activity = await prisma.marketingActivity.create({
    data: {
      contactProfileId: input.contactProfileId || null,
      campaignId: input.campaignId || null,
      audienceId: input.audienceId || null,
      storefrontScope: parseMccScope(input.storefront),
      storefront: parseStorefront(input.storefront),
      activityType: input.activityType?.trim() || "note",
      title,
      summary: input.summary?.trim() || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      actorId: input.actor.id,
      actorEmail: input.actor.email ?? null,
    },
  });
  await logAdminAction({
    actor: { id: input.actor.id, email: input.actor.email ?? null },
    action: "marketing.activity.create",
    targetType: "marketing_activity",
    targetId: activity.id,
    summary: `Created MCC activity ${activity.title}`,
    metadata: {
      activityType: activity.activityType,
      campaignId: activity.campaignId,
      audienceId: activity.audienceId,
    },
  });
  return activity;
}

export async function loadMccOverview(input: {
  storefront?: string | null;
  range?: string | string[] | null;
}): Promise<MccOverviewPayload> {
  const scope = parseMccScope(input.storefront);
  const rangeDays = parseMccRange(input.range);
  const rangeStart = nowMinusDays(rangeDays);
  const [{ contacts }, newsletter, campaigns, tasks, supportCases, audiences] = await Promise.all([
    loadMccContacts({ storefront: scope, limit: 500 }),
    getNewsletterAudienceSummary(),
    prisma.marketingCampaign.findMany({
      where: {
        ...scopeToMarketingWhere(scope),
        updatedAt: { gte: rangeStart },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.adminCustomerTask.findMany({
      where: { status: { in: ["OFFEN", "IN_BEARBEITUNG"] } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    prisma.supportCase.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.marketingAudience.findMany({
      where: scopeToMarketingWhere(scope),
      orderBy: [{ computedCount: "desc" }, { updatedAt: "desc" }],
      take: 6,
    }),
  ]);
  const automations = await listMccAutomations(scope);
  const campaignAudienceIds = Array.from(
    new Set(campaigns.map((campaign) => campaign.audienceId).filter(Boolean)),
  ) as string[];
  const campaignAudiences =
    campaignAudienceIds.length > 0
      ? await prisma.marketingAudience.findMany({
          where: { id: { in: campaignAudienceIds } },
          select: { id: true, name: true },
        })
      : [];
  const campaignAudienceNames = new Map(
    campaignAudiences.map((audience) => [audience.id, audience.name]),
  );

  const split = Object.fromEntries(
    STOREFRONTS.map((storefront) => [
      storefront,
      contacts.reduce(
        (acc, contact) => {
          if (!contact.storefronts.includes(storefront)) return acc;
          acc.contacts += 1;
          acc.revenueCents += contact.totalRevenueCents;
          acc.orders += contact.orderCount;
          return acc;
        },
        { contacts: 0, revenueCents: 0, orders: 0 },
      ),
    ]),
  ) as Record<StorefrontCode, { contacts: number; revenueCents: number; orders: number }>;
  const activeAudienceSize = contacts.length;
  const newsletterRecipients =
    scope === "ALL"
      ? newsletter.activeRecipientCount
      : newsletter.byStorefront[scope].attributedRecipientCount;
  const activeAutomations = automations.filter((flow) => flow.status === "ACTIVE").length;
  const automationHealthRate =
    automations.length > 0 ? Math.round((activeAutomations / automations.length) * 100) : 100;
  const lifecycleMap = contacts.reduce<Map<string, number>>((map, contact) => {
    map.set(contact.lifecycleStage, (map.get(contact.lifecycleStage) ?? 0) + 1);
    return map;
  }, new Map());

  return {
    scope,
    rangeDays,
    generatedAt: new Date().toISOString(),
    metrics: {
      revenueInfluencedCents: contacts.reduce(
        (sum, contact) => sum + contact.totalRevenueCents,
        0,
      ),
      activeAudienceSize,
      newsletterCoverageRate:
        activeAudienceSize > 0 ? Math.round((newsletterRecipients / activeAudienceSize) * 100) : 0,
      newsletterRecipients,
      campaignSends: campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0),
      activeCampaigns: campaigns.filter((campaign) =>
        ["READY", "SCHEDULED", "SENDING"].includes(campaign.status),
      ).length,
      automationHealthRate,
      activeAutomations,
      openCrmTasks: tasks.length,
      openSupportCases: supportCases,
    },
    split,
    lifecycle: Array.from(lifecycleMap.entries()).map(([stage, count]) => ({ stage, count })),
    funnel: [
      { label: "Contacts", value: activeAudienceSize },
      { label: "Newsletter", value: newsletterRecipients },
      {
        label: "Buyers",
        value: contacts.filter((contact) => contact.orderCount > 0).length,
      },
      {
        label: "Repeat",
        value: contacts.filter((contact) => contact.orderCount > 1).length,
      },
    ],
    topAudiences: audiences.map((audience) => ({
      id: audience.id,
      name: audience.name,
      storefrontScope: audience.storefrontScope as MarketingScope,
      computedCount: audience.computedCount,
      updatedAt: audience.updatedAt.toISOString(),
    })),
    activeCampaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      storefrontScope: campaign.storefrontScope as MarketingScope,
      audienceName: campaign.audienceId
        ? campaignAudienceNames.get(campaign.audienceId) ?? null
        : null,
      sentCount: campaign.sentCount,
      updatedAt: campaign.updatedAt.toISOString(),
    })),
    openTasks: tasks.map((task) => ({
      id: task.id,
      customerId: task.customerId,
      title: task.title,
      status: task.status,
      dueAt: toIso(task.dueAt),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

export async function loadMccPageData(input: {
  role: AdminRole;
  storefront?: string | null;
  range?: string | string[] | null;
  q?: string | null;
}): Promise<MccPagePayload> {
  const scope = parseMccScope(input.storefront);
  const [overview, contacts, audiences, campaigns, automations, activities] = await Promise.all([
    loadMccOverview({ storefront: scope, range: input.range }),
    loadMccContacts({ storefront: scope, q: input.q, limit: 80 }),
    listMccAudiences(scope),
    listMccCampaigns(scope),
    listMccAutomations(scope),
    listMccActivities({ storefront: scope }),
  ]);

  return {
    overview,
    contacts,
    audiences,
    campaigns,
    automations,
    activities,
    capabilities: {
      canWriteMarketing: hasAdminScope(input.role, "marketing.write"),
      canSendMarketing: hasAdminScope(input.role, "marketing.send"),
      canManageAutomations: hasAdminScope(input.role, "marketing.automation.manage"),
      canWriteCrm: canAdminPerformAction(input.role, "crm.write"),
    },
  };
}
