import "server-only";

import { Prisma } from "@prisma/client";
import { finishAdminJobRun, startAdminJobRun } from "@/lib/adminJobRuns";
import { executeAutomationHandler, type AutomationHandlerResult } from "@/lib/automationHandlers";
import {
  AUTOMATION_SCHEDULE_DEFAULTS,
  type AutomationHandler,
} from "@/lib/automationPolicy";
import { recordAutomationEvent } from "@/lib/automationEvents";
import { prisma } from "@/lib/prisma";

type AutomationActor = {
  id?: string | null;
  email?: string | null;
};

type AutomationPayload = Record<string, unknown>;

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 5 * 60 * 1000;
const AUTOMATION_BOOTSTRAP_MESSAGE =
  "Automation control plane tables are missing. Run `npx prisma migrate deploy` in the smokeify repo, then restart the dev server.";
const AUTOMATION_TABLE_NAMES = [
  "AutomationJob",
  "AutomationJobAttempt",
  "AutomationSchedule",
  "AutomationEvent",
  "AutomationEffect",
];

const toJsonValue = (value: Record<string, unknown> | null | undefined) =>
  (value ?? {}) as Prisma.InputJsonValue;

const serializeJob = (job: {
  id: string;
  scheduleId: string | null;
  status: string;
  handler: string;
  payload: Prisma.JsonValue;
  dedupeKey: string | null;
  maxAttempts: number;
  attemptCount: number;
  runAfter: Date;
  leasedAt: Date | null;
  leaseExpiresAt: Date | null;
  leasedBy: string | null;
  lastError: string | null;
  lastResult: Prisma.JsonValue | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  createdById: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: job.id,
  scheduleId: job.scheduleId,
  status: job.status,
  handler: job.handler,
  payload: (job.payload as Record<string, unknown> | null) ?? {},
  dedupeKey: job.dedupeKey,
  maxAttempts: job.maxAttempts,
  attemptCount: job.attemptCount,
  runAfter: job.runAfter.toISOString(),
  leasedAt: job.leasedAt?.toISOString() ?? null,
  leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
  leasedBy: job.leasedBy,
  lastError: job.lastError,
  lastResult: (job.lastResult as Record<string, unknown> | null) ?? null,
  completedAt: job.completedAt?.toISOString() ?? null,
  canceledAt: job.canceledAt?.toISOString() ?? null,
  createdById: job.createdById,
  createdByEmail: job.createdByEmail,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

export function isAutomationControlPlaneMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2021") return false;

  const table = typeof error.meta?.table === "string" ? error.meta.table : "";
  if (AUTOMATION_TABLE_NAMES.some((name) => table.includes(name))) return true;

  return AUTOMATION_TABLE_NAMES.some((name) => error.message.includes(name));
}

export function getAutomationBootstrapMessage() {
  return AUTOMATION_BOOTSTRAP_MESSAGE;
}

export async function ensureAutomationSchedules() {
  await Promise.all(
    AUTOMATION_SCHEDULE_DEFAULTS.map((schedule) =>
      prisma.automationSchedule.upsert({
        where: { key: schedule.key },
        update: {
          label: schedule.label,
          handler: schedule.handler,
          cronExpression: schedule.cronExpression,
          maxAttempts: schedule.maxAttempts,
        },
        create: {
          key: schedule.key,
          label: schedule.label,
          handler: schedule.handler,
          cronExpression: schedule.cronExpression,
          maxAttempts: schedule.maxAttempts,
        },
      }),
    ),
  );
}

export async function enqueueAutomationJob(input: {
  handler: AutomationHandler;
  payload?: AutomationPayload;
  dedupeKey?: string | null;
  runAfter?: Date | null;
  maxAttempts?: number | null;
  scheduleKey?: string | null;
  actor?: AutomationActor | null;
}) {
  await ensureAutomationSchedules();

  if (input.dedupeKey) {
    const existing = await prisma.automationJob.findFirst({
      where: {
        handler: input.handler,
        dedupeKey: input.dedupeKey,
        status: { in: ["QUEUED", "LEASED", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return existing;
    }
  }

  const schedule =
    input.scheduleKey
      ? await prisma.automationSchedule.findUnique({
          where: { key: input.scheduleKey },
          select: { id: true, maxAttempts: true },
        })
      : null;

  const job = await prisma.automationJob.create({
    data: {
      scheduleId: schedule?.id ?? null,
      handler: input.handler,
      payload: toJsonValue(input.payload),
      dedupeKey: input.dedupeKey ?? null,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? schedule?.maxAttempts ?? 3,
      createdById: input.actor?.id ?? null,
      createdByEmail: input.actor?.email ?? null,
    },
  });
  if (schedule?.id) {
    await prisma.automationSchedule.update({
      where: { id: schedule.id },
      data: {
        lastEnqueuedAt: new Date(),
      },
    });
  }
  return job;
}

async function leaseJob(jobId: string, workerId: string) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + DEFAULT_LEASE_MS);
  const leased = await prisma.automationJob.updateMany({
    where: {
      id: jobId,
      status: { in: ["QUEUED", "FAILED"] },
      runAfter: { lte: now },
    },
    data: {
      status: "LEASED",
      leasedAt: now,
      leaseExpiresAt,
      leasedBy: workerId,
    },
  });
  return leased.count > 0;
}

async function leaseNextJob(workerId: string) {
  const now = new Date();
  const candidate = await prisma.automationJob.findFirst({
    where: {
      status: { in: ["QUEUED", "FAILED"] },
      runAfter: { lte: now },
      canceledAt: null,
    },
    orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;
  const ok = await leaseJob(candidate.id, workerId);
  if (!ok) return null;
  return prisma.automationJob.findUnique({ where: { id: candidate.id } });
}

function nextRetryRunAfter(attemptCount: number) {
  return new Date(Date.now() + DEFAULT_RETRY_DELAY_MS * Math.max(1, attemptCount));
}

async function recordDerivedEvents(
  handler: AutomationHandler,
  result: AutomationHandlerResult,
  _payload: Record<string, unknown>,
) {
  if (handler === "supplier.stock.sync") {
    const lowStockCount =
      typeof result.data?.lowStockCount === "number" ? result.data.lowStockCount : 0;
    if (lowStockCount > 0) {
      await recordAutomationEvent({
        eventType: "inventory.low_stock_detected",
        aggregateType: "automation_job",
        aggregateId: String(result.data?.processed ?? "supplier-sync"),
        dedupeKey: `low-stock::${new Date().toISOString().slice(0, 13)}`,
        payload: result.data,
      });
    }
  }

  if (handler === "growvault.diagnostics.sync") {
    const failedStatusCount =
      typeof result.data?.failedStatusCount === "number"
        ? result.data.failedStatusCount
        : 0;
    if (failedStatusCount > 0) {
      await recordAutomationEvent({
        eventType: "growvault.diagnostics.failed",
        aggregateType: "automation_job",
        aggregateId: "growvault-diagnostics",
        storefront: "GROW",
        dedupeKey: `growvault-diagnostics::${new Date().toISOString().slice(0, 13)}`,
        payload: result.data,
      });
    }
  }
}

async function updateScheduleAfterJob(job: { scheduleId: string | null }, success: boolean, error?: string | null) {
  if (!job.scheduleId) return;
  await prisma.automationSchedule.update({
    where: { id: job.scheduleId },
    data: success
      ? {
          lastSucceededAt: new Date(),
          lastError: null,
          nextRunAt: null,
        }
      : {
          lastFailedAt: new Date(),
          lastError: error ?? "Automation job failed.",
        },
  });
}

export async function runAutomationJobById(input: {
  jobId: string;
  workerId?: string;
  actor?: AutomationActor | null;
}) {
  const workerId = input.workerId ?? `manual-${process.pid}`;
  const leased = await leaseJob(input.jobId, workerId);
  if (!leased) {
    const existing = await prisma.automationJob.findUnique({ where: { id: input.jobId } });
    if (!existing) {
      throw new Error("Automation job not found.");
    }
    if (existing.status === "CANCELED") {
      return {
        job: serializeJob(existing),
        result: null,
      };
    }
    if (existing.status !== "LEASED") {
      throw new Error("Automation job is not ready to run.");
    }
  }

  const job = await prisma.automationJob.findUnique({
    where: { id: input.jobId },
  });
  if (!job) {
    throw new Error("Automation job not found.");
  }

  const attemptNumber = job.attemptCount + 1;
  const attempt = await prisma.automationJobAttempt.create({
    data: {
      jobId: job.id,
      attemptNumber,
      workerId,
      status: "STARTED",
    },
  });

  const auditRun = await startAdminJobRun({
    jobType: `automation:${job.handler}`,
    summary: `Automation ${job.handler}`,
    metadata: {
      automationJobId: job.id,
      attemptNumber,
    },
    actor: {
      id: input.actor?.id ?? job.createdById,
      email: input.actor?.email ?? job.createdByEmail,
    },
  });

  try {
    const handlerResult = await executeAutomationHandler({
      handler: job.handler as AutomationHandler,
      payload: (job.payload as Record<string, unknown> | null) ?? {},
      actor: input.actor ?? {
        id: job.createdById,
        email: job.createdByEmail,
      },
    });

    await prisma.automationJobAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        result: toJsonValue(handlerResult.data),
      },
    });

    const updated = await prisma.automationJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        attemptCount: attemptNumber,
        lastError: null,
        lastResult: {
          summary: handlerResult.summary,
          ...(handlerResult.data ?? {}),
        } as Prisma.InputJsonValue,
        completedAt: new Date(),
        leaseExpiresAt: null,
        leasedAt: null,
      },
    });

    await finishAdminJobRun({
      id: auditRun.id,
      status: "SUCCEEDED",
      summary: handlerResult.summary,
      metadata: handlerResult.data,
    });

    await updateScheduleAfterJob(job, true);
    await recordDerivedEvents(
      job.handler as AutomationHandler,
      handlerResult,
      (job.payload as Record<string, unknown> | null) ?? {},
    );

    return {
      job: serializeJob(updated),
      result: handlerResult,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Automation job failed unexpectedly.";
    const deadLetter = attemptNumber >= job.maxAttempts;

    await prisma.automationJobAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });

    const updated = await prisma.automationJob.update({
      where: { id: job.id },
      data: {
        status: deadLetter ? "DEAD_LETTER" : "FAILED",
        attemptCount: attemptNumber,
        lastError: message,
        runAfter: deadLetter ? job.runAfter : nextRetryRunAfter(attemptNumber),
        leaseExpiresAt: null,
        leasedAt: null,
      },
    });

    await finishAdminJobRun({
      id: auditRun.id,
      status: "FAILED",
      summary: `Automation ${job.handler}`,
      errorMessage: message,
    });
    await updateScheduleAfterJob(job, false, message);

    return {
      job: serializeJob(updated),
      result: null,
      error: message,
    };
  }
}

export async function runAutomationJobNow(input: {
  handler: AutomationHandler;
  payload?: AutomationPayload;
  dedupeKey?: string | null;
  runAfter?: Date | null;
  maxAttempts?: number | null;
  scheduleKey?: string | null;
  actor?: AutomationActor | null;
  workerId?: string;
}) {
  const job = await enqueueAutomationJob(input);
  return runAutomationJobById({
    jobId: job.id,
    workerId: input.workerId,
    actor: input.actor,
  });
}

export async function drainAutomationQueue(input?: {
  limit?: number;
  workerId?: string;
  actor?: AutomationActor | null;
}) {
  const results: Array<Awaited<ReturnType<typeof runAutomationJobById>>> = [];
  const workerId = input?.workerId ?? `queue-${process.pid}`;
  const limit = Math.max(1, input?.limit ?? 10);

  for (let index = 0; index < limit; index += 1) {
    const next = await leaseNextJob(workerId);
    if (!next) break;
    results.push(
      await runAutomationJobById({
        jobId: next.id,
        workerId,
        actor: input?.actor,
      }),
    );
  }

  return results;
}

export async function retryAutomationJob(jobId: string) {
  const job = await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      runAfter: new Date(),
      leaseExpiresAt: null,
      leasedAt: null,
      canceledAt: null,
      lastError: null,
    },
  });
  return serializeJob(job);
}

export async function cancelAutomationJob(jobId: string) {
  const job = await prisma.automationJob.update({
    where: { id: jobId },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      leaseExpiresAt: null,
      leasedAt: null,
    },
  });
  return serializeJob(job);
}

export async function listAutomationJobs() {
  const jobs = await prisma.automationJob.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
  return jobs.map((job) => serializeJob(job));
}

export async function listAutomationSchedules() {
  await ensureAutomationSchedules();
  const schedules = await prisma.automationSchedule.findMany({
    orderBy: { key: "asc" },
  });
  return schedules.map((schedule) => ({
    id: schedule.id,
    key: schedule.key,
    label: schedule.label,
    handler: schedule.handler,
    status: schedule.status,
    cronExpression: schedule.cronExpression,
    nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    lastEnqueuedAt: schedule.lastEnqueuedAt?.toISOString() ?? null,
    lastSucceededAt: schedule.lastSucceededAt?.toISOString() ?? null,
    lastFailedAt: schedule.lastFailedAt?.toISOString() ?? null,
    lastError: schedule.lastError,
    payload: (schedule.payload as Record<string, unknown> | null) ?? null,
    maxAttempts: schedule.maxAttempts,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }));
}

export async function updateAutomationSchedule(input: {
  key: string;
  status?: "ACTIVE" | "PAUSED";
  nextRunAt?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const schedule = await prisma.automationSchedule.update({
    where: { key: input.key },
    data: {
      status: input.status,
      nextRunAt:
        typeof input.nextRunAt === "string"
          ? new Date(input.nextRunAt)
          : input.nextRunAt === null
            ? null
            : undefined,
      payload:
        typeof input.payload !== "undefined" ? toJsonValue(input.payload) : undefined,
    },
  });
  return {
    id: schedule.id,
    key: schedule.key,
    label: schedule.label,
    handler: schedule.handler,
    status: schedule.status,
    cronExpression: schedule.cronExpression,
    nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    lastEnqueuedAt: schedule.lastEnqueuedAt?.toISOString() ?? null,
    lastSucceededAt: schedule.lastSucceededAt?.toISOString() ?? null,
    lastFailedAt: schedule.lastFailedAt?.toISOString() ?? null,
    lastError: schedule.lastError,
    payload: (schedule.payload as Record<string, unknown> | null) ?? null,
    maxAttempts: schedule.maxAttempts,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}
