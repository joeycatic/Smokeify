import "server-only";

import { AdminJobRunStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id: string | null;
  email: string | null;
};

export async function startAdminJobRun(input: {
  jobType: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  actor?: AdminActor | null;
}) {
  return prisma.adminJobRun.create({
    data: {
      jobType: input.jobType,
      status: AdminJobRunStatus.RUNNING,
      summary: input.summary ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      triggeredById: input.actor?.id ?? null,
      triggeredByEmail: input.actor?.email ?? null,
    },
  });
}

export async function finishAdminJobRun(input: {
  id: string;
  status: AdminJobRunStatus;
  summary?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.adminJobRun.update({
    where: { id: input.id },
    data: {
      status: input.status,
      summary: input.summary ?? undefined,
      errorMessage: input.errorMessage ?? undefined,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      finishedAt: new Date(),
    },
  });
}

export async function listAdminJobRuns() {
  const runs = await prisma.adminJobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });

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
