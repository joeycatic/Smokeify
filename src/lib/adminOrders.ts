import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminOrderItemOption = {
  name: string;
  value: string;
};

export type AdminOrderItemRecord = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  name: string;
  manufacturer?: string | null;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  baseCostAmount: number;
  paymentFeeAmount: number;
  adjustedCostAmount: number;
  taxAmount: number;
  taxRateBasisPoints?: number | null;
  currency: string;
  imageUrl?: string | null;
  options?: AdminOrderItemOption[];
};

export type AdminOrderRecord = {
  id: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  currency: string;
  amountSubtotal: number;
  amountTax: number;
  amountShipping: number;
  amountDiscount: number;
  amountTotal: number;
  amountRefunded: number;
  stripePaymentIntent: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  confirmationEmailSentAt: string | null;
  shippingEmailSentAt: string | null;
  refundEmailSentAt: string | null;
  discountCode: string | null;
  customerEmail: string | null;
  userId: string | null;
  user: { email: string | null; name: string | null };
  items: AdminOrderItemRecord[];
};

export type AdminOrderAuditEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminOrderWebhookFailure = {
  id: string;
  eventId: string;
  type: string;
  status: string;
  createdAt: string;
};

export type AdminOrderReturnRequest = {
  id: string;
  status: string;
  requestedResolution: string;
  reason: string;
  adminNote: string | null;
  storeCreditAmount: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    quantity: number;
    orderItemId: string;
    orderItemName: string;
  }>;
};

export type AdminOrderDetail = {
  order: AdminOrderRecord;
  auditLogs: AdminOrderAuditEntry[];
  webhookFailures: AdminOrderWebhookFailure[];
  returnRequests: AdminOrderReturnRequest[];
};

export function normalizeOrderItemOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const name = typeof entry?.name === "string" ? entry.name : "";
      const optionValue = typeof entry?.value === "string" ? entry.value : "";
      return name && optionValue ? { name, value: optionValue } : null;
    })
    .filter((entry): entry is AdminOrderItemOption => Boolean(entry));
}

function serializeAdminOrder(
  order: Prisma.OrderGetPayload<{
    include: {
      items: true;
      user: { select: { email: true; name: true } };
    };
  }>,
  manufacturerByProductId: Map<string, string | null>,
): AdminOrderRecord {
  return {
    ...order,
    user: order.user ?? { email: null, name: null },
    items: order.items.map((item) => ({
      ...item,
      manufacturer: item.productId
        ? manufacturerByProductId.get(item.productId) ?? null
        : null,
      options: normalizeOrderItemOptions(item.options),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    confirmationEmailSentAt: order.confirmationEmailSentAt?.toISOString() ?? null,
    shippingEmailSentAt: order.shippingEmailSentAt?.toISOString() ?? null,
    refundEmailSentAt: order.refundEmailSentAt?.toISOString() ?? null,
  };
}

async function getManufacturerByProductId(productIds: string[]) {
  const products = await prisma.product.findMany({
    where: productIds.length ? { id: { in: productIds } } : { id: "__none__" },
    select: { id: true, manufacturer: true },
  });
  return new Map(products.map((product) => [product.id, product.manufacturer ?? null]));
}

export async function loadAdminOrders() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      user: { select: { email: true, name: true } },
    },
  });
  const productIds = Array.from(
    new Set(
      orders.flatMap((order) =>
        order.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const manufacturerByProductId = await getManufacturerByProductId(productIds);

  return orders.map((order) => serializeAdminOrder(order, manufacturerByProductId));
}

export async function loadAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: { select: { email: true, name: true } },
      returnRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              orderItem: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  const productIds = order.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const manufacturerByProductId = await getManufacturerByProductId(productIds);

  const [auditLogs, webhookFailures] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { targetType: "order", targetId: orderId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.processedWebhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    order: serializeAdminOrder(order, manufacturerByProductId),
    auditLogs: auditLogs.map((entry) => ({
      id: entry.id,
      actorEmail: entry.actorEmail,
      action: entry.action,
      summary: entry.summary,
      metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
      createdAt: entry.createdAt.toISOString(),
    })),
    webhookFailures: webhookFailures.map((entry) => ({
      id: entry.id,
      eventId: entry.eventId,
      type: entry.type,
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
    })),
    returnRequests: order.returnRequests.map((request) => ({
      id: request.id,
      status: request.status,
      requestedResolution: request.requestedResolution,
      reason: request.reason,
      adminNote: request.adminNote,
      storeCreditAmount: request.storeCreditAmount,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      items: request.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        orderItemId: item.orderItemId,
        orderItemName: item.orderItem.name,
      })),
    })),
  };
}
