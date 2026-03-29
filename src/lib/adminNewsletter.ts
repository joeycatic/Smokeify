import "server-only";

import { prisma } from "@/lib/prisma";
import { STOREFRONTS, type StorefrontCode } from "@/lib/storefronts";

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? null;

const createStorefrontRecipientMap = () =>
  Object.fromEntries(STOREFRONTS.map((storefront) => [storefront, new Set<string>()])) as Record<
    StorefrontCode,
    Set<string>
  >;

export type NewsletterAudienceSummary = {
  activeRecipientCount: number;
  subscriberCount: number;
  optedInUserCount: number;
  suppressedUserCount: number;
  unresolvedRecipientCount: number;
  byStorefront: Record<
    StorefrontCode,
    {
      attributedRecipientCount: number;
    }
  >;
};

export type StorefrontNewsletterAudience = {
  recipients: string[];
  unresolvedRecipientCount: number;
};

async function collectActiveNewsletterAudience() {
  const [subscriberRows, optedInUserRows, suppressedUserRows] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where: { unsubscribedAt: null },
      select: { email: true, userId: true },
    }),
    prisma.user.findMany({
      where: {
        newsletterOptIn: true,
        email: { not: null },
      },
      select: { id: true, email: true },
    }),
    prisma.user.findMany({
      where: {
        newsletterOptIn: false,
        email: { not: null },
      },
      select: { email: true },
    }),
  ]);

  const suppressedEmails = new Set(
    suppressedUserRows
      .map((entry) => normalizeEmail(entry.email))
      .filter((entry): entry is string => Boolean(entry)),
  );
  const activeRecipients = new Map<string, { userIds: Set<string> }>();

  for (const entry of subscriberRows) {
    const email = normalizeEmail(entry.email);
    if (!email || suppressedEmails.has(email)) continue;
    const current = activeRecipients.get(email) ?? { userIds: new Set<string>() };
    if (entry.userId) current.userIds.add(entry.userId);
    activeRecipients.set(email, current);
  }

  for (const entry of optedInUserRows) {
    const email = normalizeEmail(entry.email);
    if (!email || suppressedEmails.has(email)) continue;
    const current = activeRecipients.get(email) ?? { userIds: new Set<string>() };
    current.userIds.add(entry.id);
    activeRecipients.set(email, current);
  }

  if (activeRecipients.size === 0) {
    return {
      recipients: [],
      unresolvedRecipients: [],
      recipientsByStorefront: createStorefrontRecipientMap(),
    };
  }

  const activeEmails = Array.from(activeRecipients.keys());
  const activeUserIds = Array.from(
    new Set(
      Array.from(activeRecipients.values()).flatMap((entry) => Array.from(entry.userIds.values())),
    ),
  );
  const storefrontClauses = [];
  if (activeEmails.length > 0) {
    storefrontClauses.push({ customerEmail: { in: activeEmails } });
  }
  if (activeUserIds.length > 0) {
    storefrontClauses.push({ userId: { in: activeUserIds } });
  }

  const orders =
    storefrontClauses.length > 0
      ? await prisma.order.findMany({
          where: {
            sourceStorefront: { not: null },
            OR: storefrontClauses,
          },
          select: {
            customerEmail: true,
            sourceStorefront: true,
            user: {
              select: { email: true },
            },
          },
        })
      : [];

  const storefrontsByEmail = new Map<string, Set<StorefrontCode>>();

  for (const order of orders) {
    if (!order.sourceStorefront) continue;
    const orderEmails = [normalizeEmail(order.customerEmail), normalizeEmail(order.user?.email)].filter(
      (entry): entry is string => Boolean(entry),
    );
    for (const email of orderEmails) {
      if (!activeRecipients.has(email)) continue;
      const current = storefrontsByEmail.get(email) ?? new Set<StorefrontCode>();
      current.add(order.sourceStorefront as StorefrontCode);
      storefrontsByEmail.set(email, current);
    }
  }

  const recipientsByStorefront = createStorefrontRecipientMap();
  const unresolvedRecipients: string[] = [];

  for (const email of activeEmails) {
    const storefronts = storefrontsByEmail.get(email);
    if (!storefronts || storefronts.size === 0) {
      unresolvedRecipients.push(email);
      continue;
    }
    for (const storefront of storefronts) {
      recipientsByStorefront[storefront].add(email);
    }
  }

  return {
    recipients: activeEmails,
    unresolvedRecipients,
    recipientsByStorefront,
  };
}

export async function getActiveNewsletterRecipients() {
  const audience = await collectActiveNewsletterAudience();
  return audience.recipients;
}

export async function getStorefrontNewsletterAudience(
  storefront: StorefrontCode,
): Promise<StorefrontNewsletterAudience> {
  const audience = await collectActiveNewsletterAudience();
  return {
    recipients: Array.from(audience.recipientsByStorefront[storefront].values()),
    unresolvedRecipientCount: audience.unresolvedRecipients.length,
  };
}

export async function getNewsletterAudienceSummary(): Promise<NewsletterAudienceSummary> {
  const [audience, subscriberCount, optedInUserCount, suppressedUserCount] = await Promise.all([
    collectActiveNewsletterAudience(),
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    prisma.user.count({
      where: {
        newsletterOptIn: true,
        email: { not: null },
      },
    }),
    prisma.user.count({
      where: {
        newsletterOptIn: false,
        email: { not: null },
      },
    }),
  ]);

  return {
    activeRecipientCount: audience.recipients.length,
    subscriberCount,
    optedInUserCount,
    suppressedUserCount,
    unresolvedRecipientCount: audience.unresolvedRecipients.length,
    byStorefront: {
      MAIN: {
        attributedRecipientCount: audience.recipientsByStorefront.MAIN.size,
      },
      GROW: {
        attributedRecipientCount: audience.recipientsByStorefront.GROW.size,
      },
    },
  };
}
