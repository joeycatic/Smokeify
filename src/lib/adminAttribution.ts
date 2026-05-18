import "server-only";

import type { Storefront } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { parseStorefrontHostFromUrl, resolveStorefrontFromHost } from "@/lib/storefrontHosts";
import { parseStorefront, STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";

type AdminActor = {
  id?: string | null;
  email?: string | null;
};

type CandidateSourceType =
  | "metadata"
  | "origin"
  | "host"
  | "customer_history"
  | "ambiguous"
  | "none";

export type OrderAttributionCandidate = {
  storefront: StorefrontCode | null;
  sourceType: CandidateSourceType;
  detail: string;
  exact: boolean;
};

type UnresolvedOrderRow = {
  id: string;
  orderNumber: number;
  userId: string | null;
  customerEmail: string | null;
  sourceStorefront: Storefront | null;
  sourceHost: string | null;
  sourceOrigin: string | null;
  stripeSessionId: string;
  createdAt: Date;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function deriveOrderAttributionCandidate(input: {
  sourceStorefront: string | null;
  sourceOrigin: string | null;
  sourceHost: string | null;
  metadataSourceStorefront?: string | null;
  historyStorefronts?: StorefrontCode[];
}): OrderAttributionCandidate {
  const metadataStorefront = parseStorefront(input.metadataSourceStorefront ?? null);
  if (metadataStorefront) {
    return {
      storefront: metadataStorefront,
      sourceType: "metadata",
      detail: `Stripe metadata sourceStorefront = ${metadataStorefront}`,
      exact: true,
    };
  }

  const explicitStorefront = parseStorefront(input.sourceStorefront);
  if (explicitStorefront) {
    return {
      storefront: explicitStorefront,
      sourceType: "metadata",
      detail: `Order sourceStorefront = ${explicitStorefront}`,
      exact: true,
    };
  }

  const originStorefront = resolveStorefrontFromHost(
    parseStorefrontHostFromUrl(input.sourceOrigin),
  );
  if (originStorefront) {
    return {
      storefront: originStorefront,
      sourceType: "origin",
      detail: `Exact origin match ${input.sourceOrigin}`,
      exact: true,
    };
  }

  const hostStorefront = resolveStorefrontFromHost(input.sourceHost);
  if (hostStorefront) {
    return {
      storefront: hostStorefront,
      sourceType: "host",
      detail: `Exact host match ${input.sourceHost}`,
      exact: true,
    };
  }

  const uniqueHistory = Array.from(new Set(input.historyStorefronts ?? []));
  if (uniqueHistory.length === 1) {
    return {
      storefront: uniqueHistory[0] ?? null,
      sourceType: "customer_history",
      detail: `Unique prior storefront history (${STOREFRONT_LABELS[uniqueHistory[0] ?? "MAIN"]})`,
      exact: true,
    };
  }

  if (uniqueHistory.length > 1) {
    return {
      storefront: null,
      sourceType: "ambiguous",
      detail: "Customer history spans multiple storefronts.",
      exact: false,
    };
  }

  return {
    storefront: null,
    sourceType: "none",
    detail: "No exact attribution source found.",
    exact: false,
  };
}

async function loadHistoryStorefronts(order: UnresolvedOrderRow): Promise<StorefrontCode[]> {
  const email = normalizeEmail(order.customerEmail);
  const history = await prisma.order.findMany({
    where: {
      id: { not: order.id },
      sourceStorefront: { not: null },
      OR: [
        ...(order.userId ? [{ userId: order.userId }] : []),
        ...(email ? [{ customerEmail: { equals: email, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { sourceStorefront: true },
    take: 10,
  });

  return history
    .map((entry) => parseStorefront(entry.sourceStorefront))
    .filter((entry): entry is StorefrontCode => entry !== null);
}

export async function listUnresolvedOrderAttributionRows() {
  const unresolvedOrders = await prisma.order.findMany({
    where: { sourceStorefront: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      customerEmail: true,
      sourceStorefront: true,
      sourceHost: true,
      sourceOrigin: true,
      stripeSessionId: true,
      createdAt: true,
    },
    take: 200,
  });

  const rows = await Promise.all(
    unresolvedOrders.map(async (order) => {
      const historyStorefronts = await loadHistoryStorefronts(order);
      const candidate = deriveOrderAttributionCandidate({
        sourceStorefront: order.sourceStorefront,
        sourceOrigin: order.sourceOrigin,
        sourceHost: order.sourceHost,
        historyStorefronts,
      });

      return {
        ...order,
        customerEmail: order.customerEmail,
        createdAt: order.createdAt.toISOString(),
        candidate,
      };
    }),
  );

  const evidenceCounts = rows.reduce<Record<CandidateSourceType, number>>(
    (acc, row) => {
      acc[row.candidate.sourceType] += 1;
      return acc;
    },
    {
      metadata: 0,
      origin: 0,
      host: 0,
      customer_history: 0,
      ambiguous: 0,
      none: 0,
    },
  );

  return {
    rows,
    evidenceCounts,
  };
}

export async function applyManualOrderAttribution(input: {
  orderId: string;
  storefront: StorefrontCode;
  reason: string;
  actor: AdminActor;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("A short reason is required.");
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, orderNumber: true, sourceStorefront: true },
  });
  if (!order) {
    throw new Error("Order not found.");
  }

  const updated = await prisma.order.update({
    where: { id: input.orderId },
    data: {
      sourceStorefront: input.storefront as Storefront,
    },
    select: {
      id: true,
      orderNumber: true,
      sourceStorefront: true,
    },
  });

  await logAdminAction({
    actor: input.actor,
    action: "order.attribution.update",
    targetType: "order",
    targetId: updated.id,
    summary: `Updated storefront attribution for order #${updated.orderNumber}`,
    metadata: {
      previousStorefront: order.sourceStorefront,
      nextStorefront: updated.sourceStorefront,
      reason,
    },
  });

  return updated;
}
