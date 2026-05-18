import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";
import { issueAdminStoreCredit } from "@/lib/adminStoreCredit";

export async function POST(
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
    key: `admin-customer-store-credit:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return adminJson({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    amountCents?: number;
    reason?: string;
    adminPassword?: string;
  };

  const amountCents = Math.floor(Number(body.amountCents ?? 0));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword.trim() : "";

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return adminJson({ error: "Amount must be greater than zero." }, { status: 400 });
  }
  if (!reason) {
    return adminJson({ error: "Reason is required." }, { status: 400 });
  }
  if (!adminPassword) {
    return adminJson({ error: "Admin password is required." }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!admin?.passwordHash) {
    return adminJson({ error: "Admin password is required." }, { status: 400 });
  }
  const validPassword = await bcrypt.compare(adminPassword, admin.passwordHash);
  if (!validPassword) {
    return adminJson({ error: "Admin password is incorrect." }, { status: 401 });
  }

  const { id } = await context.params;
  let result;
  try {
    result = await issueAdminStoreCredit({
      userId: id,
      amountCents,
      reason: `admin_issue:${reason}`,
      actor: { id: session.user.id, email: session.user.email ?? null },
      metadata: { note: reason },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Customer not found.") {
      return adminJson({ error: "Customer not found." }, { status: 404 });
    }
    throw error;
  }

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "customer.store_credit.issue",
    targetType: "user",
    targetId: result.customer.id,
    summary: `Issued ${amountCents} store credit to ${result.customer.email ?? result.customer.id}`,
    metadata: {
      amountCents,
      reason,
      previousBalance: result.previousBalance,
      nextBalance: result.nextBalance,
    },
  });

  return adminJson({
    storeCreditBalance: result.nextBalance,
  });
}
