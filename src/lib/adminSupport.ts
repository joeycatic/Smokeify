import "server-only";

import {
  Prisma,
  SupportCasePriority,
  SupportCaseSourceType,
  SupportCaseStatus,
} from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id: string | null;
  email: string | null;
};

const SUPPORT_CASE_INCLUDE = {
  linkedOrder: {
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      shippingName: true,
    },
  },
  linkedCustomer: {
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  },
  returnRequest: {
    select: {
      id: true,
      status: true,
      requestedResolution: true,
    },
  },
  contactSubmission: {
    select: {
      id: true,
      name: true,
      email: true,
      message: true,
      createdAt: true,
      processedAt: true,
    },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
} as const;

type SupportCaseWithRelations = Prisma.SupportCaseGetPayload<{
  include: typeof SUPPORT_CASE_INCLUDE;
}>;

function formatCustomerLabel(input: {
  email: string | null;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const fullName =
    input.name?.trim() ||
    [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(" ").trim();
  return fullName || input.email || "Unknown customer";
}

function serializeSupportCase(supportCase: SupportCaseWithRelations) {
  const linkedCustomer = supportCase.linkedCustomer
    ? {
        id: supportCase.linkedCustomer.id,
        email: supportCase.linkedCustomer.email,
        label: formatCustomerLabel(supportCase.linkedCustomer),
      }
    : null;

  return {
    id: supportCase.id,
    linkedOrderId: supportCase.linkedOrderId,
    linkedCustomerId: supportCase.linkedCustomerId,
    returnRequestId: supportCase.returnRequestId,
    contactSubmissionId: supportCase.contactSubmissionId,
    sourceType: supportCase.sourceType,
    status: supportCase.status,
    priority: supportCase.priority,
    assigneeUserId: supportCase.assigneeUserId,
    assigneeEmail: supportCase.assigneeEmail,
    createdById: supportCase.createdById,
    createdByEmail: supportCase.createdByEmail,
    summary: supportCase.summary,
    resolutionNote: supportCase.resolutionNote,
    latestCustomerEventAt: supportCase.latestCustomerEventAt?.toISOString() ?? null,
    resolvedAt: supportCase.resolvedAt?.toISOString() ?? null,
    createdAt: supportCase.createdAt.toISOString(),
    updatedAt: supportCase.updatedAt.toISOString(),
    linkedOrder: supportCase.linkedOrder
      ? {
          id: supportCase.linkedOrder.id,
          orderNumber: supportCase.linkedOrder.orderNumber,
          customerEmail: supportCase.linkedOrder.customerEmail,
          shippingName: supportCase.linkedOrder.shippingName,
        }
      : null,
    linkedCustomer,
    returnRequest: supportCase.returnRequest ? supportCase.returnRequest : null,
    contactSubmission: supportCase.contactSubmission
      ? {
          ...supportCase.contactSubmission,
          createdAt: supportCase.contactSubmission.createdAt.toISOString(),
          processedAt: supportCase.contactSubmission.processedAt?.toISOString() ?? null,
        }
      : null,
    events: supportCase.events.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      actorEmail: event.actorEmail,
      eventType: event.eventType,
      summary: event.summary,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function appendSupportEvent(input: {
  supportCaseId: string;
  actor?: AdminActor | null;
  eventType: string;
  summary: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.supportCaseEvent.create({
    data: {
      supportCaseId: input.supportCaseId,
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      eventType: input.eventType,
      summary: input.summary,
      note: input.note ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
    },
  });
}

export async function listAdminSupportCases() {
  const cases = await prisma.supportCase.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: SUPPORT_CASE_INCLUDE,
  });

  return cases.map(serializeSupportCase);
}

export async function listAdminSupportOwners() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "STAFF"] },
      adminAccessDisabledAt: null,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: formatCustomerLabel(user),
    role: user.role,
  }));
}

export async function createManualSupportCase(input: {
  linkedOrderId?: string | null;
  linkedCustomerId?: string | null;
  priority?: SupportCasePriority;
  summary: string;
  note?: string | null;
  actor: AdminActor;
}) {
  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("Summary is required.");
  }

  const supportCase = await prisma.supportCase.create({
    data: {
      linkedOrderId: input.linkedOrderId ?? null,
      linkedCustomerId: input.linkedCustomerId ?? null,
      sourceType: SupportCaseSourceType.MANUAL,
      priority: input.priority ?? SupportCasePriority.MEDIUM,
      summary,
      createdById: input.actor.id,
      createdByEmail: input.actor.email,
      events: {
        create: {
          actorId: input.actor.id,
          actorEmail: input.actor.email,
          eventType: "support_case.created",
          summary: "Manual support case created",
          note: input.note?.trim() || null,
        },
      },
    },
    include: SUPPORT_CASE_INCLUDE,
  });

  await logAdminAction({
    actor: input.actor,
    action: "support_case.create",
    targetType: "support_case",
    targetId: supportCase.id,
    summary: `Created support case ${supportCase.id}`,
  });

  return serializeSupportCase(supportCase);
}

export async function updateAdminSupportCase(
  supportCaseId: string,
  input: {
    status?: SupportCaseStatus;
    priority?: SupportCasePriority;
    assigneeUserId?: string | null;
    summary?: string;
    resolutionNote?: string | null;
    note?: string | null;
    actor: AdminActor;
  },
) {
  const existing = await prisma.supportCase.findUnique({
    where: { id: supportCaseId },
    include: SUPPORT_CASE_INCLUDE,
  });
  if (!existing) {
    throw new Error("Support case not found.");
  }

  const assignee =
    typeof input.assigneeUserId !== "undefined"
      ? input.assigneeUserId
        ? await prisma.user.findFirst({
            where: {
              id: input.assigneeUserId,
              role: { in: ["ADMIN", "STAFF"] },
            },
            select: { id: true, email: true },
          })
        : null
      : undefined;
  if (typeof input.assigneeUserId !== "undefined" && input.assigneeUserId && !assignee) {
    throw new Error("Assignee not found.");
  }

  const summary =
    typeof input.summary === "string" ? input.summary.trim() || existing.summary : undefined;
  const resolutionNote =
    typeof input.resolutionNote === "string"
      ? input.resolutionNote.trim() || null
      : input.resolutionNote;

  const supportCase = await prisma.supportCase.update({
    where: { id: supportCaseId },
    data: {
      status: input.status,
      priority: input.priority,
      assigneeUserId:
        typeof input.assigneeUserId !== "undefined"
          ? assignee?.id ?? null
          : undefined,
      assigneeEmail:
        typeof input.assigneeUserId !== "undefined"
          ? assignee?.email ?? null
          : undefined,
      summary,
      resolutionNote:
        typeof input.resolutionNote !== "undefined" ? resolutionNote : undefined,
      resolvedAt:
        input.status === SupportCaseStatus.RESOLVED
          ? new Date()
          : typeof input.status !== "undefined"
            ? null
            : undefined,
    },
    include: SUPPORT_CASE_INCLUDE,
  });

  const eventSummaries: string[] = [];
  if (typeof input.status !== "undefined" && input.status !== existing.status) {
    eventSummaries.push(`Status ${existing.status} -> ${input.status}`);
  }
  if (typeof input.priority !== "undefined" && input.priority !== existing.priority) {
    eventSummaries.push(`Priority ${existing.priority} -> ${input.priority}`);
  }
  if (
    typeof input.assigneeUserId !== "undefined" &&
    (assignee?.id ?? null) !== existing.assigneeUserId
  ) {
    eventSummaries.push(
      assignee?.email ? `Assigned to ${assignee.email}` : "Assignee cleared",
    );
  }
  if (summary && summary !== existing.summary) {
    eventSummaries.push("Summary updated");
  }
  if (typeof input.resolutionNote !== "undefined") {
    eventSummaries.push("Resolution note updated");
  }

  if (eventSummaries.length > 0 || input.note?.trim()) {
    await appendSupportEvent({
      supportCaseId,
      actor: input.actor,
      eventType: "support_case.updated",
      summary: eventSummaries.join(" · ") || "Support case note added",
      note: input.note?.trim() || null,
    });
  }

  await logAdminAction({
    actor: input.actor,
    action: "support_case.update",
    targetType: "support_case",
    targetId: supportCaseId,
    summary: `Updated support case ${supportCaseId}`,
    metadata: {
      status: input.status,
      priority: input.priority,
      assigneeUserId: assignee?.id ?? input.assigneeUserId ?? undefined,
    },
  });

  return serializeSupportCase(supportCase);
}

export async function ensureReturnRequestSupportCase(input: {
  returnRequestId: string;
  actor?: AdminActor | null;
}) {
  const existing = await prisma.supportCase.findUnique({
    where: { returnRequestId: input.returnRequestId },
    include: SUPPORT_CASE_INCLUDE,
  });
  if (existing) return serializeSupportCase(existing);

  const request = await prisma.returnRequest.findUnique({
    where: { id: input.returnRequestId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          shippingName: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  if (!request) {
    throw new Error("Return request not found.");
  }

  const supportCase = await prisma.supportCase.create({
    data: {
      linkedOrderId: request.orderId,
      linkedCustomerId: request.userId,
      returnRequestId: request.id,
      sourceType: SupportCaseSourceType.RETURN_REQUEST,
      summary: `Return request for order #${request.order.orderNumber}`,
      createdById: input.actor?.id ?? null,
      createdByEmail: input.actor?.email ?? null,
      events: {
        create: {
          actorId: input.actor?.id ?? null,
          actorEmail: input.actor?.email ?? null,
          eventType: "support_case.created",
          summary: `Case created from return request ${request.id}`,
        },
      },
    },
    include: SUPPORT_CASE_INCLUDE,
  });

  return serializeSupportCase(supportCase);
}

export async function ensureContactSubmissionSupportCase(input: {
  contactSubmissionId: string;
}) {
  const existing = await prisma.supportCase.findUnique({
    where: { contactSubmissionId: input.contactSubmissionId },
    include: SUPPORT_CASE_INCLUDE,
  });
  if (existing) return serializeSupportCase(existing);

  const submission = await prisma.contactSubmission.findUnique({
    where: { id: input.contactSubmissionId },
  });
  if (!submission) {
    throw new Error("Contact submission not found.");
  }

  const supportCase = await prisma.supportCase.create({
    data: {
      contactSubmissionId: submission.id,
      sourceType: SupportCaseSourceType.CONTACT_SUBMISSION,
      summary: `Contact form from ${submission.name}`,
      latestCustomerEventAt: submission.createdAt,
      events: {
        create: {
          eventType: "support_case.created",
          summary: "Case created from contact submission",
          note: submission.message,
        },
      },
    },
    include: SUPPORT_CASE_INCLUDE,
  });

  return serializeSupportCase(supportCase);
}

export async function appendSupportEventForOrderEmail(input: {
  orderId: string;
  emailType: string;
  reason: string;
  actor: AdminActor;
}) {
  const cases = await prisma.supportCase.findMany({
    where: { linkedOrderId: input.orderId },
    select: { id: true },
  });
  if (!cases.length) return;

  await Promise.all(
    cases.map((supportCase) =>
      appendSupportEvent({
        supportCaseId: supportCase.id,
        actor: input.actor,
        eventType: "support_case.order_email_sent",
        summary: `Sent ${input.emailType} email`,
        note: input.reason,
      }),
    ),
  );
}
