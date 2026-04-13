import "server-only";

import { prisma } from "@/lib/prisma";

export type ReturnRequestSelectionInput = Array<{ id: string; quantity?: number }>;

type ReturnRequestOrder = {
  id: string;
  userId: string | null;
  customerEmail: string | null;
  shippingName: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
};

type ReturnRequestResolution = "REFUND" | "STORE_CREDIT" | "EXCHANGE";

export class ReturnRequestSubmissionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReturnRequestSubmissionError";
    this.status = status;
  }
}

export function buildSelectedReturnItems(
  order: ReturnRequestOrder,
  items: ReturnRequestSelectionInput,
) {
  const itemMap = new Map(order.items.map((item) => [item.id, item]));
  const selected = items
    .map((item) => {
      const orderItem = itemMap.get(item.id);
      if (!orderItem) return null;
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      return {
        orderItemId: orderItem.id,
        quantity: Math.min(quantity, orderItem.quantity),
      };
    })
    .filter((item): item is { orderItemId: string; quantity: number } => Boolean(item));

  if (!selected.length) {
    throw new ReturnRequestSubmissionError("Select items to return.");
  }

  return selected;
}

export async function ensureNoPendingReturnRequest(orderId: string) {
  const existing = await prisma.returnRequest.findFirst({
    where: { orderId, status: "PENDING" },
    select: { id: true },
  });

  if (existing) {
    throw new ReturnRequestSubmissionError("Return request already submitted.", 409);
  }
}

export async function createReturnRequestForOrder(input: {
  order: ReturnRequestOrder;
  reason: string;
  items: ReturnRequestSelectionInput;
  requestedResolution?: ReturnRequestResolution;
  exchangePreference?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  submissionSource: "account" | "refund_link";
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new ReturnRequestSubmissionError("Missing return reason.");
  }

  await ensureNoPendingReturnRequest(input.order.id);

  const selectedItems = buildSelectedReturnItems(input.order, input.items);
  const requestedResolution = input.requestedResolution ?? "REFUND";
  const exchangePreference =
    requestedResolution === "EXCHANGE"
      ? input.exchangePreference?.trim() || null
      : null;

  const created = await prisma.returnRequest.create({
    data: {
      orderId: input.order.id,
      userId: input.order.userId,
      reason,
      requestedResolution,
      exchangePreference,
      items: { create: selectedItems },
    },
  });

  await prisma.order.update({
    where: { id: input.order.id },
    data: { status: "return_requested" },
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: input.order.userId,
      actorEmail: input.requesterEmail?.trim() || input.order.customerEmail,
      action: "order.lifecycle.return_requested",
      targetType: "order",
      targetId: input.order.id,
      summary: `Return request submitted (${requestedResolution.toLowerCase()})`,
      metadata: {
        returnRequestId: created.id,
        requestedResolution,
        requesterName: input.requesterName?.trim() || input.order.shippingName,
        requesterEmail: input.requesterEmail?.trim() || input.order.customerEmail,
        submissionSource: input.submissionSource,
        items: selectedItems,
      },
    },
  });

  return created;
}
