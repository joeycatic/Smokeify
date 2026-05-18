import { AdminAlertPriority, AdminAlertStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";

const REPEAT_WINDOW_MS = 60 * 60 * 1000;

export type DerivedAdminAlert = {
  type: string;
  category: string;
  priority: "critical" | "high" | "medium";
  dedupeKey: string;
  title: string;
  detail: string;
  href: string;
  actionLabel?: string;
};

export type AdminAlertQueueItem = {
  id: string;
  type: string;
  category: string;
  priority: "critical" | "high" | "medium";
  dedupeKey: string;
  title: string;
  detail: string;
  href: string;
  actionLabel: string | null;
  status: "open" | "acknowledged" | "resolved" | "snoozed";
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  repeatCount: number;
  signalActive: boolean;
  signalClearedAt: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  events: Array<{
    id: string;
    actorEmail: string | null;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
};

export type AdminAlertAssignee = {
  id: string;
  email: string | null;
  name: string | null;
};

type AdminActor = {
  id?: string | null;
  email?: string | null;
};

const priorityFromDerived = (priority: DerivedAdminAlert["priority"]) =>
  priority === "critical"
    ? AdminAlertPriority.CRITICAL
    : priority === "high"
      ? AdminAlertPriority.HIGH
      : AdminAlertPriority.MEDIUM;

const serializePriority = (priority: AdminAlertPriority) => priority.toLowerCase() as AdminAlertQueueItem["priority"];
const serializeStatus = (status: AdminAlertStatus) => status.toLowerCase() as AdminAlertQueueItem["status"];

export function buildAlertDedupeKey(parts: string[]) {
  return parts.map((part) => part.trim().toLowerCase()).join("::");
}

function serializeAlert(
  alert: Prisma.AdminAlertGetPayload<{
    include: { events: { orderBy: { createdAt: "desc" }; take: 10 } };
  }>,
): AdminAlertQueueItem {
  return {
    id: alert.id,
    type: alert.type,
    category: alert.category,
    priority: serializePriority(alert.priority),
    dedupeKey: alert.dedupeKey,
    title: alert.title,
    detail: alert.detail,
    href: alert.href,
    actionLabel: alert.actionLabel,
    status: serializeStatus(alert.status),
    assigneeUserId: alert.assigneeUserId,
    assigneeEmail: alert.assigneeEmail,
    firstSeenAt: alert.firstSeenAt.toISOString(),
    lastSeenAt: alert.lastSeenAt.toISOString(),
    repeatCount: alert.repeatCount,
    signalActive: alert.signalActive,
    signalClearedAt: alert.signalClearedAt?.toISOString() ?? null,
    snoozedUntil: alert.snoozedUntil?.toISOString() ?? null,
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    resolutionNote: alert.resolutionNote,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
    events: alert.events.map((event) => ({
      id: event.id,
      actorEmail: event.actorEmail,
      eventType: event.eventType,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      note: event.note,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function createAlertEvent(input: {
  alertId: string;
  actor?: AdminActor | null;
  eventType: string;
  fromStatus?: AdminAlertStatus | null;
  toStatus?: AdminAlertStatus | null;
  note?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.adminAlertEvent.create({
    data: {
      alertId: input.alertId,
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function syncAdminAlerts(derivedAlerts: DerivedAdminAlert[]) {
  const now = new Date();
  const activeKeys = new Set(derivedAlerts.map((alert) => alert.dedupeKey));
  const existingAlerts = await prisma.adminAlert.findMany({
    where: {
      OR: [
        { dedupeKey: { in: derivedAlerts.map((alert) => alert.dedupeKey) } },
        { signalActive: true },
      ],
    },
  });
  const existingByKey = new Map(existingAlerts.map((alert) => [alert.dedupeKey, alert]));

  for (const alert of derivedAlerts) {
    const existing = existingByKey.get(alert.dedupeKey);
    if (!existing) {
      const created = await prisma.adminAlert.create({
        data: {
          type: alert.type,
          category: alert.category,
          priority: priorityFromDerived(alert.priority),
          dedupeKey: alert.dedupeKey,
          title: alert.title,
          detail: alert.detail,
          href: alert.href,
          actionLabel: alert.actionLabel ?? null,
          firstSeenAt: now,
          lastSeenAt: now,
          signalActive: true,
        },
      });
      await createAlertEvent({
        alertId: created.id,
        eventType: "alert.signal.created",
        toStatus: created.status,
        metadata: { dedupeKey: alert.dedupeKey, href: alert.href },
      });
      continue;
    }

    let nextStatus = existing.status;
    let nextSnoozedUntil = existing.snoozedUntil;
    let nextResolvedAt = existing.resolvedAt;
    const statusChangedFromSync =
      existing.status === AdminAlertStatus.RESOLVED ||
      (existing.status === AdminAlertStatus.SNOOZED &&
        existing.snoozedUntil !== null &&
        existing.snoozedUntil <= now);

    if (statusChangedFromSync) {
      nextStatus = AdminAlertStatus.OPEN;
      nextSnoozedUntil = null;
      nextResolvedAt = null;
    }

    const shouldIncrementRepeatCount =
      !existing.signalActive ||
      now.getTime() - existing.lastSeenAt.getTime() >= REPEAT_WINDOW_MS;

    const updated = await prisma.adminAlert.update({
      where: { id: existing.id },
      data: {
        type: alert.type,
        category: alert.category,
        priority: priorityFromDerived(alert.priority),
        title: alert.title,
        detail: alert.detail,
        href: alert.href,
        actionLabel: alert.actionLabel ?? null,
        lastSeenAt: now,
        repeatCount: shouldIncrementRepeatCount ? existing.repeatCount + 1 : existing.repeatCount,
        signalActive: true,
        signalClearedAt: null,
        status: nextStatus,
        snoozedUntil: nextSnoozedUntil,
        resolvedAt: nextResolvedAt,
      },
    });

    if (statusChangedFromSync) {
      await createAlertEvent({
        alertId: updated.id,
        eventType: "alert.signal.reopened",
        fromStatus: existing.status,
        toStatus: updated.status,
        metadata: { dedupeKey: alert.dedupeKey, href: alert.href },
      });
    }
  }

  const activeAlertsToClear = existingAlerts.filter(
    (alert) => alert.signalActive && !activeKeys.has(alert.dedupeKey),
  );

  for (const alert of activeAlertsToClear) {
    await prisma.adminAlert.update({
      where: { id: alert.id },
      data: {
        signalActive: false,
        signalClearedAt: now,
      },
    });
    await createAlertEvent({
      alertId: alert.id,
      eventType: "alert.signal.cleared",
      fromStatus: alert.status,
      toStatus: alert.status,
    });
  }
}

export async function getAdminAlertsQueueData() {
  const [alerts, assignees] = await Promise.all([
    prisma.adminAlert.findMany({
      orderBy: [
        { signalActive: "desc" },
        { priority: "asc" },
        { updatedAt: "desc" },
      ],
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
      },
    }),
  ]);

  return {
    alerts: alerts.map((alert) => serializeAlert(alert)),
    assignees,
  };
}

export async function mutateAdminAlert(input: {
  alertId: string;
  actor: AdminActor;
  action: "assign" | "acknowledge" | "resolve" | "snooze" | "reopen";
  assigneeUserId?: string | null;
  snoozedUntil?: Date | null;
  resolutionNote?: string | null;
}) {
  const alert = await prisma.adminAlert.findUnique({
    where: { id: input.alertId },
  });
  if (!alert) {
    throw new Error("Alert not found.");
  }

  let data: Prisma.AdminAlertUpdateInput = {};
  let eventType = "";
  let summary = "";
  let note: string | null = null;

  if (input.action === "assign") {
    if (input.assigneeUserId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assigneeUserId },
        select: { id: true, email: true, role: true },
      });
      if (!assignee || (assignee.role !== "ADMIN" && assignee.role !== "STAFF")) {
        throw new Error("Assignee must be an admin or staff account.");
      }
      data = {
        assigneeUserId: assignee.id,
        assigneeEmail: assignee.email ?? null,
      };
      summary = `Assigned alert to ${assignee.email ?? assignee.id}`;
    } else {
      data = {
        assigneeUserId: null,
        assigneeEmail: null,
      };
      summary = "Cleared alert assignee";
    }
    eventType = "alert.assigned";
  }

  if (input.action === "acknowledge") {
    data = {
      status: AdminAlertStatus.ACKNOWLEDGED,
      snoozedUntil: null,
      resolvedAt: null,
    };
    eventType = "alert.acknowledged";
    summary = "Acknowledged alert";
  }

  if (input.action === "resolve") {
    note = input.resolutionNote?.trim() || null;
    data = {
      status: AdminAlertStatus.RESOLVED,
      resolvedAt: new Date(),
      snoozedUntil: null,
      resolutionNote: note,
    };
    eventType = "alert.resolved";
    summary = note ? `Resolved alert: ${note}` : "Resolved alert";
  }

  if (input.action === "snooze") {
    if (!input.snoozedUntil || input.snoozedUntil <= new Date()) {
      throw new Error("Snooze time must be in the future.");
    }
    data = {
      status: AdminAlertStatus.SNOOZED,
      snoozedUntil: input.snoozedUntil,
      resolvedAt: null,
    };
    eventType = "alert.snoozed";
    summary = `Snoozed alert until ${input.snoozedUntil.toISOString()}`;
  }

  if (input.action === "reopen") {
    data = {
      status: AdminAlertStatus.OPEN,
      snoozedUntil: null,
      resolvedAt: null,
    };
    eventType = "alert.reopened";
    summary = "Reopened alert";
  }

  const updated = await prisma.adminAlert.update({
    where: { id: input.alertId },
    data,
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  await createAlertEvent({
    alertId: input.alertId,
    actor: input.actor,
    eventType,
    fromStatus: alert.status,
    toStatus: updated.status,
    note,
    metadata:
      input.action === "assign"
        ? { assigneeUserId: updated.assigneeUserId, assigneeEmail: updated.assigneeEmail }
        : input.action === "snooze"
          ? { snoozedUntil: updated.snoozedUntil?.toISOString() ?? null }
          : undefined,
  });

  await logAdminAction({
    actor: input.actor,
    action: `admin.alert.${input.action}`,
    targetType: "admin_alert",
    targetId: input.alertId,
    summary,
    metadata: {
      fromStatus: alert.status,
      toStatus: updated.status,
      assigneeUserId: updated.assigneeUserId,
      assigneeEmail: updated.assigneeEmail,
      snoozedUntil: updated.snoozedUntil?.toISOString() ?? null,
      resolutionNote: updated.resolutionNote,
    },
  });

  return serializeAlert(updated);
}
