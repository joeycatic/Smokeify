import "server-only";

import { CustomerGroup, Prisma } from "@prisma/client";
import { createAdminCustomerTask } from "@/lib/adminCustomerTasks";
import { syncAdminAlerts } from "@/lib/adminAlerts";
import { ensureReturnRequestSupportCase } from "@/lib/adminSupport";
import { prisma } from "@/lib/prisma";
import type { AutomationEffectType, AutomationEventType } from "@/lib/automationPolicy";

type AutomationActor = {
  id?: string | null;
  email?: string | null;
};

const toJsonValue = (value: Record<string, unknown> | undefined) =>
  (value ?? {}) as Prisma.InputJsonValue;

function buildSuppressionBucket(hours: number, at = new Date()) {
  return Math.floor(at.getTime() / (hours * 60 * 60 * 1000));
}

function buildSuppressionKey(prefix: string, identity: string, hours: number) {
  return `${prefix}::${identity}::${buildSuppressionBucket(hours)}`;
}

async function createEffectOnce(input: {
  eventId: string;
  effectType: AutomationEffectType;
  dedupeKey: string;
  targetType: string;
  payload?: Record<string, unknown>;
  run: () => Promise<string | null | undefined>;
}) {
  const existing = await prisma.automationEffect.findUnique({
    where: { dedupeKey: input.dedupeKey },
    select: { id: true, targetId: true },
  });
  if (existing) {
    return existing.targetId ?? null;
  }

  try {
    const targetId = (await input.run()) ?? null;
    await prisma.automationEffect.create({
      data: {
        eventId: input.eventId,
        effectType: input.effectType,
        dedupeKey: input.dedupeKey,
        targetType: input.targetType,
        targetId,
        status: "APPLIED",
        payload: toJsonValue(input.payload),
      },
    });
    return targetId;
  } catch (error) {
    await prisma.automationEffect.create({
      data: {
        eventId: input.eventId,
        effectType: input.effectType,
        dedupeKey: input.dedupeKey,
        targetType: input.targetType,
        status: "FAILED",
        lastError: error instanceof Error ? error.message : "Unknown automation effect error.",
        payload: toJsonValue(input.payload),
      },
    });
    throw error;
  }
}

async function processOrderPaidEvent(event: {
  id: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) {
  const order = await prisma.order.findUnique({
    where: { id: event.aggregateId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          customerGroup: true,
        },
      },
    },
  });
  if (!order?.userId || !order.user) return;

  const isVipCandidate =
    order.user.customerGroup === CustomerGroup.VIP || order.amountTotal >= 50_000;
  if (!isVipCandidate) return;

  await createEffectOnce({
    eventId: event.id,
    effectType: "admin_customer_task.created",
    dedupeKey: buildSuppressionKey("vip-follow-up", order.id, 72),
    targetType: "admin_customer_task",
    payload: { orderId: order.id, customerId: order.userId },
    run: async () => {
      const task = await createAdminCustomerTask({
        customerId: order.userId!,
        playbook: "VIP_BETREUUNG",
        title: `VIP follow-up for order #${order.orderNumber}`,
        description:
          order.sourceStorefront === "GROW"
            ? "High-value Growvault order. Review whether a concierge follow-up is warranted."
            : "High-value paid order. Review whether a concierge follow-up is warranted.",
        actor: {
          id: "automation",
          email: "automation@smokeify.local",
        },
      });
      return task.id;
    },
  });
}

async function processReturnRequestEvent(event: {
  id: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) {
  const request = await prisma.returnRequest.findUnique({
    where: { id: event.aggregateId },
    include: {
      order: {
        select: { orderNumber: true, customerEmail: true },
      },
      user: {
        select: { id: true, email: true },
      },
    },
  });
  if (!request) return;

  await createEffectOnce({
    eventId: event.id,
    effectType: "support_case.created_or_reused",
    dedupeKey: `support-case::return-request::${request.id}`,
    targetType: "support_case",
    payload: { returnRequestId: request.id },
    run: async () => {
      const supportCase = await ensureReturnRequestSupportCase({
        returnRequestId: request.id,
        actor: {
          id: request.userId,
          email:
            request.user?.email ??
            request.order.customerEmail ??
            "automation@smokeify.local",
        },
      });
      return supportCase.id;
    },
  });

  if (request.userId) {
    await createEffectOnce({
      eventId: event.id,
      effectType: "admin_customer_task.created",
      dedupeKey: buildSuppressionKey("return-risk-follow-up", request.id, 72),
      targetType: "admin_customer_task",
      payload: { returnRequestId: request.id, customerId: request.userId },
      run: async () => {
        const task = await createAdminCustomerTask({
          customerId: request.userId!,
          playbook: "RETOUREN_RISIKO",
          title: `Return-risk follow-up for order #${request.order.orderNumber}`,
          description:
            "A return request was opened or updated. Review whether the customer needs proactive handling.",
          actor: {
            id: "automation",
            email: "automation@smokeify.local",
          },
        });
        return task.id;
      },
    });
  }
}

async function processAnalyzerEvent(event: {
  id: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) {
  const run = await prisma.plantAnalysisRun.findUnique({
    where: { id: event.aggregateId },
    select: {
      id: true,
      reviewStatus: true,
      safetyFlags: true,
      reviewedAt: true,
    },
  });
  if (!run) return;

  const isFlagged =
    run.reviewStatus !== "REVIEWED_OK" || (run.safetyFlags?.length ?? 0) > 0;
  if (!isFlagged) return;

  await createEffectOnce({
    eventId: event.id,
    effectType: "admin_alert.synced",
    dedupeKey: buildSuppressionKey("analyzer-governance", run.id, 24),
    targetType: "admin_alert",
    payload: { analysisId: run.id, reviewStatus: run.reviewStatus },
    run: async () => {
      await syncAdminAlerts([
        {
          type: "analyzer_governance_case",
          category: "Analyzer",
          priority: "high",
          dedupeKey: `analyzer::${run.id}`,
          title: "Analyzer case needs governance review",
          detail: `Plant analyzer run ${run.id} is ${run.reviewStatus} with ${run.safetyFlags.length} safety flags.`,
          href: "/admin/analyzer",
          actionLabel: "Open analyzer queue",
        },
      ]);
      const alert = await prisma.adminAlert.findFirst({
        where: { dedupeKey: `analyzer::${run.id}` },
        select: { id: true },
      });
      return alert?.id ?? null;
    },
  });
}

async function processLowStockEvent(event: {
  id: string;
  payload: Record<string, unknown>;
}) {
  const count =
    typeof event.payload.lowStockCount === "number" ? event.payload.lowStockCount : 0;
  if (count <= 0) return;

  await createEffectOnce({
    eventId: event.id,
    effectType: "admin_alert.synced",
    dedupeKey: buildSuppressionKey("low-stock-risk", "global", 12),
    targetType: "admin_alert",
    payload: event.payload,
    run: async () => {
      await syncAdminAlerts([
        {
          type: "inventory_low_stock_risk",
          category: "Inventory",
          priority: "high",
          dedupeKey: "inventory::low-stock-risk",
          title: "Low-stock risk detected",
          detail: `${count} active variants are at or below their low-stock threshold.`,
          href: "/admin/procurement",
          actionLabel: "Open procurement",
        },
      ]);
      const alert = await prisma.adminAlert.findFirst({
        where: { dedupeKey: "inventory::low-stock-risk" },
        select: { id: true },
      });
      return alert?.id ?? null;
    },
  });
}

async function processGrowvaultDiagnosticsFailureEvent(event: {
  id: string;
  payload: Record<string, unknown>;
}) {
  const failingKeys = Array.isArray(event.payload.failingKeys)
    ? event.payload.failingKeys.filter((entry): entry is string => typeof entry === "string")
    : [];
  if (failingKeys.length === 0) return;

  await createEffectOnce({
    eventId: event.id,
    effectType: "admin_alert.synced",
    dedupeKey: buildSuppressionKey("growvault-diagnostics", "global", 6),
    targetType: "admin_alert",
    payload: event.payload,
    run: async () => {
      await syncAdminAlerts([
        {
          type: "growvault_diagnostics_failed",
          category: "Growvault",
          priority: "high",
          dedupeKey: "growvault::diagnostics-failed",
          title: "Growvault diagnostics reported failures",
          detail: `Diagnostics failing keys: ${failingKeys.join(", ")}`,
          href: "/admin/growvault",
          actionLabel: "Open Growvault diagnostics",
        },
      ]);
      const alert = await prisma.adminAlert.findFirst({
        where: { dedupeKey: "growvault::diagnostics-failed" },
        select: { id: true },
      });
      return alert?.id ?? null;
    },
  });
}

export async function processAutomationEventById(eventId: string) {
  const event = await prisma.automationEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      eventType: true,
      aggregateType: true,
      aggregateId: true,
      payload: true,
    },
  });
  if (!event) {
    return null;
  }

  const payload = (event.payload as Record<string, unknown> | null) ?? {};
  try {
    switch (event.eventType as AutomationEventType) {
      case "order.paid":
        await processOrderPaidEvent({ ...event, payload });
        break;
      case "return_request.created":
      case "return_request.updated":
        await processReturnRequestEvent({ ...event, payload });
        break;
      case "analyzer.reviewed":
      case "analyzer.flagged":
        await processAnalyzerEvent({ ...event, payload });
        break;
      case "inventory.low_stock_detected":
        await processLowStockEvent({ ...event, payload });
        break;
      case "growvault.diagnostics.failed":
        await processGrowvaultDiagnosticsFailureEvent({ ...event, payload });
        break;
      default:
        break;
    }

    await prisma.automationEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    await prisma.automationEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lastError:
          error instanceof Error ? error.message : "Unknown automation event error.",
      },
    });
    throw error;
  }

  return event.id;
}

export async function recordAutomationEvent(input: {
  eventType: AutomationEventType;
  aggregateType: string;
  aggregateId: string;
  storefront?: "MAIN" | "GROW" | null;
  dedupeKey?: string | null;
  payload?: Record<string, unknown>;
}) {
  const event = await prisma.automationEvent.create({
    data: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      storefront: input.storefront ?? null,
      dedupeKey: input.dedupeKey ?? null,
      payload: toJsonValue(input.payload),
    },
  });

  await processAutomationEventById(event.id);
  return event;
}
