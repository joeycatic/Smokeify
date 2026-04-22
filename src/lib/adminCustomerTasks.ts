import { Prisma } from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";
import { prisma } from "@/lib/prisma";

export const ADMIN_CUSTOMER_TASK_STATUSES = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "WIEDERVORLAGE",
  "ERLEDIGT",
] as const;
export const ADMIN_CUSTOMER_TASK_PLAYBOOKS = [
  "RUECKGEWINNUNG",
  "VIP_BETREUUNG",
  "RETOUREN_RISIKO",
  "MARGE_SCHUETZEN",
  "MANUELL",
] as const;
export const ADMIN_CUSTOMER_COHORT_STATUSES = [
  "ENTWURF",
  "AKTIV",
  "IN_BEARBEITUNG",
  "ABGESCHLOSSEN",
] as const;

export type AdminCustomerTaskStatus = (typeof ADMIN_CUSTOMER_TASK_STATUSES)[number];
export type AdminCustomerTaskPlaybook = (typeof ADMIN_CUSTOMER_TASK_PLAYBOOKS)[number];
export type AdminCustomerCohortStatus = (typeof ADMIN_CUSTOMER_COHORT_STATUSES)[number];

export type AdminCustomerTaskRecord = {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  createdById: string | null;
  createdByEmail: string | null;
  sourceCohortId: string | null;
  status: AdminCustomerTaskStatus;
  playbook: AdminCustomerTaskPlaybook;
  title: string;
  description: string | null;
  dueAt: string | null;
  snoozedUntil: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomerTaskOwner = {
  id: string;
  email: string | null;
  name: string | null;
};

const TASK_INCLUDE = {
  customer: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  owner: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.AdminCustomerTaskInclude;

const normalizeTaskStatus = (value: unknown): AdminCustomerTaskStatus | null =>
  typeof value === "string" &&
  ADMIN_CUSTOMER_TASK_STATUSES.includes(value as AdminCustomerTaskStatus)
    ? (value as AdminCustomerTaskStatus)
    : null;

const normalizePlaybook = (value: unknown): AdminCustomerTaskPlaybook | null =>
  typeof value === "string" &&
  ADMIN_CUSTOMER_TASK_PLAYBOOKS.includes(value as AdminCustomerTaskPlaybook)
    ? (value as AdminCustomerTaskPlaybook)
    : null;

const normalizeCohortStatus = (value: unknown): AdminCustomerCohortStatus | null =>
  typeof value === "string" &&
  ADMIN_CUSTOMER_COHORT_STATUSES.includes(value as AdminCustomerCohortStatus)
    ? (value as AdminCustomerCohortStatus)
    : null;

const parseOptionalDate = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const serializeTask = (
  task: Prisma.AdminCustomerTaskGetPayload<{ include: typeof TASK_INCLUDE }>,
): AdminCustomerTaskRecord => ({
  id: task.id,
  customerId: task.customerId,
  customerEmail: task.customer.email ?? null,
  customerName: task.customer.name ?? null,
  ownerId: task.ownerId,
  ownerEmail: task.owner?.email ?? null,
  ownerName: task.owner?.name ?? null,
  createdById: task.createdById,
  createdByEmail: task.createdBy?.email ?? null,
  sourceCohortId: task.sourceCohortId,
  status: task.status,
  playbook: task.playbook,
  title: task.title,
  description: task.description,
  dueAt: task.dueAt?.toISOString() ?? null,
  snoozedUntil: task.snoozedUntil?.toISOString() ?? null,
  completedAt: task.completedAt?.toISOString() ?? null,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
});

export function formatAdminCustomerTaskStatusLabel(value: AdminCustomerTaskStatus) {
  switch (value) {
    case "IN_BEARBEITUNG":
      return "In Bearbeitung";
    case "WIEDERVORLAGE":
      return "Wiedervorlage";
    case "ERLEDIGT":
      return "Erledigt";
    default:
      return "Offen";
  }
}

export function formatAdminCustomerTaskPlaybookLabel(value: AdminCustomerTaskPlaybook) {
  switch (value) {
    case "RUECKGEWINNUNG":
      return "Rückgewinnung";
    case "VIP_BETREUUNG":
      return "VIP-Betreuung";
    case "RETOUREN_RISIKO":
      return "Retouren-Risiko";
    case "MARGE_SCHUETZEN":
      return "Marge schützen";
    default:
      return "Manuell";
  }
}

export function formatAdminCustomerCohortStatusLabel(value: AdminCustomerCohortStatus) {
  switch (value) {
    case "AKTIV":
      return "Aktiv";
    case "IN_BEARBEITUNG":
      return "In Bearbeitung";
    case "ABGESCHLOSSEN":
      return "Abgeschlossen";
    default:
      return "Entwurf";
  }
}

async function getTaskOwners() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}

export async function listAdminCustomerTasks(filters: {
  customerId?: string | null;
  status?: AdminCustomerTaskStatus | null;
}) {
  const [tasks, owners] = await Promise.all([
    prisma.adminCustomerTask.findMany({
      where: {
        customerId: filters.customerId ?? undefined,
        status: filters.status ?? undefined,
      },
      include: TASK_INCLUDE,
      orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: filters.customerId ? 20 : 80,
    }),
    getTaskOwners(),
  ]);

  return {
    tasks: tasks.map(serializeTask),
    owners,
  };
}

export async function createAdminCustomerTask(input: {
  customerId: string;
  ownerId?: string | null;
  sourceCohortId?: string | null;
  status?: AdminCustomerTaskStatus | null;
  playbook?: AdminCustomerTaskPlaybook | null;
  title?: string | null;
  description?: string | null;
  dueAt?: string | null;
  actor: { id: string; email: string | null };
}) {
  const customer = await prisma.user.findUnique({
    where: { id: input.customerId },
    select: { id: true, email: true, role: true, name: true },
  });
  if (!customer || customer.role !== "USER") {
    throw new Error("Customer not found.");
  }

  const owner =
    input.ownerId
      ? await prisma.user.findUnique({
          where: { id: input.ownerId },
          select: { id: true, email: true, role: true, name: true },
        })
      : null;
  if (owner && !["ADMIN", "STAFF"].includes(owner.role)) {
    throw new Error("Owner must be an admin or staff user.");
  }

  const playbook = input.playbook ?? "MANUELL";
  const title =
    input.title?.trim() ||
    `${formatAdminCustomerTaskPlaybookLabel(playbook)} · ${customer.email ?? customer.id}`;
  const task = await prisma.adminCustomerTask.create({
    data: {
      customerId: customer.id,
      ownerId: owner?.id ?? null,
      createdById: input.actor.id,
      sourceCohortId: input.sourceCohortId ?? null,
      status: input.status ?? "OFFEN",
      playbook,
      title,
      description: input.description?.trim() || null,
      dueAt: parseOptionalDate(input.dueAt),
    },
    include: TASK_INCLUDE,
  });

  await logAdminAction({
    actor: input.actor,
    action: "admin.crm.task.erstellt",
    targetType: "admin_customer_task",
    targetId: task.id,
    summary: `CRM-Aufgabe für ${customer.email ?? customer.id} erstellt`,
    metadata: {
      ownerId: owner?.id ?? null,
      ownerEmail: owner?.email ?? null,
      playbook,
      status: task.status,
      sourceCohortId: task.sourceCohortId,
    },
  });

  return serializeTask(task);
}

export async function updateAdminCustomerTask(input: {
  taskId: string;
  ownerId?: string | null;
  status?: AdminCustomerTaskStatus | null;
  playbook?: AdminCustomerTaskPlaybook | null;
  title?: string | null;
  description?: string | null;
  dueAt?: string | null;
  snoozedUntil?: string | null;
  actor: { id: string; email: string | null };
}) {
  const existing = await prisma.adminCustomerTask.findUnique({
    where: { id: input.taskId },
    include: TASK_INCLUDE,
  });
  if (!existing) {
    throw new Error("CRM task not found.");
  }

  const owner =
    input.ownerId
      ? await prisma.user.findUnique({
          where: { id: input.ownerId },
          select: { id: true, email: true, role: true, name: true },
        })
      : input.ownerId === null
        ? null
        : undefined;
  if (owner && !["ADMIN", "STAFF"].includes(owner.role)) {
    throw new Error("Owner must be an admin or staff user.");
  }

  const nextStatus = input.status ?? existing.status;
  const task = await prisma.adminCustomerTask.update({
    where: { id: input.taskId },
    data: {
      ownerId: owner === undefined ? existing.ownerId : owner?.id ?? null,
      status: nextStatus,
      playbook: input.playbook ?? existing.playbook,
      title: input.title?.trim() || existing.title,
      description:
        typeof input.description === "string"
          ? input.description.trim() || null
          : existing.description,
      dueAt:
        typeof input.dueAt === "string" ? parseOptionalDate(input.dueAt) : existing.dueAt,
      snoozedUntil:
        typeof input.snoozedUntil === "string"
          ? parseOptionalDate(input.snoozedUntil)
          : existing.snoozedUntil,
      completedAt: nextStatus === "ERLEDIGT" ? new Date() : null,
    },
    include: TASK_INCLUDE,
  });

  await logAdminAction({
    actor: input.actor,
    action: "admin.crm.task.aktualisiert",
    targetType: "admin_customer_task",
    targetId: task.id,
    summary: `CRM-Aufgabe ${task.title} aktualisiert`,
    metadata: {
      previousStatus: existing.status,
      nextStatus: task.status,
      previousOwnerId: existing.ownerId,
      nextOwnerId: task.ownerId,
      dueAt: task.dueAt?.toISOString() ?? null,
      snoozedUntil: task.snoozedUntil?.toISOString() ?? null,
    },
  });

  return serializeTask(task);
}

export async function updateAdminCustomerCohort(input: {
  cohortId: string;
  status?: AdminCustomerCohortStatus | null;
  assigneeUserId?: string | null;
  actor: { id: string; email: string | null };
}) {
  const existing = await prisma.adminCustomerCohort.findUnique({
    where: { id: input.cohortId },
  });
  if (!existing) {
    throw new Error("Cohort not found.");
  }

  const owner =
    input.assigneeUserId
      ? await prisma.user.findUnique({
          where: { id: input.assigneeUserId },
          select: { id: true, email: true, role: true },
        })
      : input.assigneeUserId === null
        ? null
        : undefined;
  if (owner && !["ADMIN", "STAFF"].includes(owner.role)) {
    throw new Error("Assignee must be an admin or staff user.");
  }

  const cohort = await prisma.adminCustomerCohort.update({
    where: { id: input.cohortId },
    data: {
      status: input.status ?? existing.status,
      assigneeUserId: owner === undefined ? existing.assigneeUserId : owner?.id ?? null,
      assigneeEmail: owner === undefined ? existing.assigneeEmail : owner?.email ?? null,
    },
  });

  await logAdminAction({
    actor: input.actor,
    action: "admin.crm.cohort.aktualisiert",
    targetType: "admin_customer_cohort",
    targetId: cohort.id,
    summary: `CRM-Kohorte ${cohort.name} aktualisiert`,
    metadata: {
      previousStatus: existing.status,
      nextStatus: cohort.status,
      previousAssigneeUserId: existing.assigneeUserId,
      nextAssigneeUserId: cohort.assigneeUserId,
      nextAssigneeEmail: cohort.assigneeEmail,
    },
  });

  return {
    id: cohort.id,
    name: cohort.name,
    description: cohort.description,
    customerCount: cohort.customerCount,
    filters: cohort.filters,
    createdByEmail: cohort.createdByEmail,
    assigneeUserId: cohort.assigneeUserId,
    assigneeEmail: cohort.assigneeEmail,
    status: cohort.status,
    createdAt: cohort.createdAt.toISOString(),
    updatedAt: cohort.updatedAt.toISOString(),
  };
}

export function parseCustomerTaskStatus(value: unknown) {
  return normalizeTaskStatus(value);
}

export function parseCustomerTaskPlaybook(value: unknown) {
  return normalizePlaybook(value);
}

export function parseCustomerCohortStatus(value: unknown) {
  return normalizeCohortStatus(value);
}
