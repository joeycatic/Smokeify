import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";

const normalizeFlags = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set(
    value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
      .slice(0, 12),
  );
  return Array.from(unique);
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin-customer-patch:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return adminJson({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await context.params;
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, notes: true, crmFlags: true, role: true },
  });
  if (!existing || existing.role !== "USER") {
    return adminJson({ error: "Customer not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    notes?: string | null;
    crmFlags?: string[];
  };

  const nextNotes =
    typeof body.notes === "string" ? body.notes.trim() || null : existing.notes;
  const nextFlags = body.crmFlags !== undefined ? normalizeFlags(body.crmFlags) : existing.crmFlags;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      notes: nextNotes,
      crmFlags: nextFlags,
    },
    select: {
      id: true,
      notes: true,
      crmFlags: true,
      updatedAt: true,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "customer.crm.update",
    targetType: "user",
    targetId: id,
    summary: `Updated CRM notes/flags for ${existing.email ?? id}`,
    metadata: {
      previousNotes: existing.notes,
      nextNotes: updated.notes,
      previousFlags: existing.crmFlags,
      nextFlags: updated.crmFlags,
    },
  });

  return adminJson({
    customer: {
      id: updated.id,
      notes: updated.notes,
      crmFlags: updated.crmFlags,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
