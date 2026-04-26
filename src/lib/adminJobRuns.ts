import "server-only";

import { AdminJobRunStatus, Prisma } from "@prisma/client";
import { isMissingAdminJobRunStorageError } from "@/lib/adminStorageGuards";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id: string | null;
  email: string | null;
};

const buildMissingAdminJobRunRecord = (input: {
  id?: string;
  jobType: string;
  status: AdminJobRunStatus;
  summary?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  actor?: AdminActor | null;
  startedAt?: Date;
  finishedAt?: Date | null;
}) => {
  const now = new Date();

  return {
    id: input.id ?? `missing-admin-job-run-${now.getTime()}`,
    jobType: input.jobType,
    status: input.status,
    triggeredById: input.actor?.id ?? null,
    triggeredByEmail: input.actor?.email ?? null,
    summary: input.summary ?? null,
    errorMessage: input.errorMessage ?? null,
    metadata: (input.metadata as Prisma.JsonValue | undefined) ?? null,
    startedAt: input.startedAt ?? now,
    finishedAt: input.finishedAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
};

export async function startAdminJobRun(input: {
  jobType: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  actor?: AdminActor | null;
}) {
  try {
    return await prisma.adminJobRun.create({
      data: {
        jobType: input.jobType,
        status: AdminJobRunStatus.RUNNING,
        summary: input.summary ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        triggeredById: input.actor?.id ?? null,
        triggeredByEmail: input.actor?.email ?? null,
      },
    });
  } catch (error) {
    if (isMissingAdminJobRunStorageError(error)) {
      return buildMissingAdminJobRunRecord({
        jobType: input.jobType,
        status: AdminJobRunStatus.RUNNING,
        summary: input.summary,
        metadata: input.metadata,
        actor: input.actor,
      });
    }
    throw error;
  }
}

export async function finishAdminJobRun(input: {
  id: string;
  status: AdminJobRunStatus;
  summary?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await prisma.adminJobRun.update({
      where: { id: input.id },
      data: {
        status: input.status,
        summary: input.summary ?? undefined,
        errorMessage: input.errorMessage ?? undefined,
        metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    if (isMissingAdminJobRunStorageError(error)) {
      return buildMissingAdminJobRunRecord({
        id: input.id,
        jobType: "missing-admin-job-run",
        status: input.status,
        summary: input.summary,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
        finishedAt: new Date(),
      });
    }
    throw error;
  }
}

export async function listAdminJobRuns() {
  let runs: Array<{
    id: string;
    jobType: string;
    status: AdminJobRunStatus;
    triggeredById: string | null;
    triggeredByEmail: string | null;
    summary: string | null;
    errorMessage: string | null;
    metadata: Prisma.JsonValue | null;
    startedAt: Date;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  try {
    runs = await prisma.adminJobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    });
  } catch (error) {
    if (!isMissingAdminJobRunStorageError(error)) {
      throw error;
    }
  }

  return runs.map((run) => ({
    id: run.id,
    jobType: run.jobType,
    status: run.status,
    triggeredById: run.triggeredById,
    triggeredByEmail: run.triggeredByEmail,
    summary: run.summary,
    errorMessage: run.errorMessage,
    metadata: (run.metadata as Record<string, unknown> | null) ?? null,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }));
}
