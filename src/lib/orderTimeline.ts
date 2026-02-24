import { Prisma } from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";

type OrderTimelineActor = {
  id?: string | null;
  email?: string | null;
};

type OrderTimelineEventInput = {
  actor?: OrderTimelineActor | null;
  orderId: string;
  action:
    | "order.lifecycle.created"
    | "order.lifecycle.status_changed"
    | "order.lifecycle.payment_status_changed"
    | "order.lifecycle.payment_failed"
    | "order.lifecycle.refund_updated";
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logOrderTimelineEvent(input: OrderTimelineEventInput) {
  await logAdminAction({
    actor: input.actor,
    action: input.action,
    targetType: "order",
    targetId: input.orderId,
    summary: input.summary,
    metadata: input.metadata,
  });
}

