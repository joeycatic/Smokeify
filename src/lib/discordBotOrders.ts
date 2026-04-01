import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";

const DEFAULT_ORDER_LIMIT = 5;
const MAX_ORDER_LIMIT = 10;

type BotOrderRow = Awaited<ReturnType<typeof getOrdersByCustomerId>>[number];

function getDiscordBotApiKey(): string | null {
  return process.env.DISCORD_BOT_API_KEY?.trim() || process.env.CRON_SECRET?.trim() || null;
}

export function getDiscordBotAuthError(request: Request) {
  const expectedSecret = getDiscordBotApiKey();
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({ error: "Discord bot order API is not configured." }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const authorized = isCronRequestAuthorized({
    authorizationHeader: request.headers.get("authorization"),
    headerSecret: request.headers.get("x-api-key"),
    expectedSecret,
  });

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return null;
}

export function parseBotCustomerId(request: Request): string | null {
  const customerId = new URL(request.url).searchParams.get("customerId")?.trim();
  return customerId || null;
}

export function parseBotOrderLimit(request: Request): number {
  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? DEFAULT_ORDER_LIMIT);
  if (!Number.isFinite(rawLimit)) {
    return DEFAULT_ORDER_LIMIT;
  }

  return Math.max(1, Math.min(MAX_ORDER_LIMIT, Math.trunc(rawLimit)));
}

function formatPrice(amountCents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function buildOrderSummary(order: BotOrderRow) {
  const itemLabels = order.items
    .slice(0, 2)
    .map((item) => (item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name));
  const remainingItems = Math.max(order.items.length - itemLabels.length, 0);

  return remainingItems > 0 ? `${itemLabels.join(", ")} +${remainingItems} more` : itemLabels.join(", ");
}

export function serializeBotOrder(order: BotOrderRow) {
  return {
    id: order.id,
    reference: `#${order.orderNumber}`,
    orderNumber: order.orderNumber,
    status: order.status,
    totalFormatted: formatPrice(order.amountTotal, order.currency),
    updatedAt: order.updatedAt.toISOString(),
    summary: buildOrderSummary(order),
    trackingUrl: order.trackingUrl,
  };
}

export async function getOrdersByCustomerId(customerId: string, limit: number) {
  return prisma.order.findMany({
    where: {
      userId: customerId,
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
      amountTotal: true,
      updatedAt: true,
      trackingUrl: true,
      items: {
        select: {
          name: true,
          quantity: true,
        },
        orderBy: {
          id: "asc",
        },
      },
    },
  });
}

export async function getOrderByLookup(customerId: string, orderLookup: string) {
  const normalizedLookup = decodeURIComponent(orderLookup).trim();
  const numericLookup = normalizedLookup.replace(/^#/, "");
  const orderNumber =
    /^\d+$/.test(numericLookup) && Number.isSafeInteger(Number(numericLookup))
      ? Number(numericLookup)
      : null;

  return prisma.order.findFirst({
    where: {
      userId: customerId,
      OR: [
        { id: normalizedLookup },
        ...(orderNumber === null ? [] : [{ orderNumber }]),
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currency: true,
      amountTotal: true,
      updatedAt: true,
      trackingUrl: true,
      items: {
        select: {
          name: true,
          quantity: true,
        },
        orderBy: {
          id: "asc",
        },
      },
    },
  });
}
