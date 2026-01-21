import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id?: string | null;
  email?: string | null;
};

type AuditLogInput = {
  actor?: AdminActor | null;
  action: string;
  targetType?: string;
  targetId?: string;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logAdminAction(input: AuditLogInput) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  } catch {
    // Best-effort logging: avoid blocking admin flows.
  }
}
