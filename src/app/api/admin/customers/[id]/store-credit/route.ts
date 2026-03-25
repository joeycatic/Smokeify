import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import { adminJson } from "@/lib/adminApi";

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
  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      storeCreditBalance: true,
    },
  });
  if (!customer || customer.role !== "USER") {
    return adminJson({ error: "Customer not found." }, { status: 404 });
  }

  const nextBalance = customer.storeCreditBalance + amountCents;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: customer.id },
      data: { storeCreditBalance: nextBalance },
    }),
    prisma.storeCreditTransaction.create({
      data: {
        userId: customer.id,
        amountDelta: amountCents,
        reason: `admin_issue:${reason}`,
        metadata: {
          source: "admin.crm",
          issuedById: session.user.id,
          issuedByEmail: session.user.email ?? null,
          previousBalance: customer.storeCreditBalance,
          nextBalance,
          note: reason,
        },
      },
    }),
  ]);

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "customer.store_credit.issue",
    targetType: "user",
    targetId: customer.id,
    summary: `Issued ${amountCents} store credit to ${customer.email ?? customer.id}`,
    metadata: {
      amountCents,
      reason,
      previousBalance: customer.storeCreditBalance,
      nextBalance,
    },
  });

  return adminJson({
    storeCreditBalance: nextBalance,
  });
}
