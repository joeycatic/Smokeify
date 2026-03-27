import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOnly } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  ensureAnotherEnabledAdminExists,
  verifyAdminPassword,
} from "@/lib/adminUserGovernance";

export async function GET() {
  const session = await requireAdminOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminTotpEnabledAt: true,
      adminTotpPendingSecretEncrypted: true,
      adminAccessDisabledAt: true,
      sessions: { select: { id: true } },
      devices: { select: { id: true } },
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      adminTotpEnabled: Boolean(user.adminTotpEnabledAt),
      adminTotpPending: Boolean(user.adminTotpPendingSecretEncrypted),
      adminAccessDisabledAt: user.adminAccessDisabledAt?.toISOString() ?? null,
      sessionCount: user.sessions.length,
      deviceCount: user.devices.length,
      createdAt: user.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-users:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdminOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    role?: string;
    adminPassword?: string;
  };
  if (!body.id || !body.role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const adminPassword = body.adminPassword?.trim() ?? "";
  if (!adminPassword) {
    return NextResponse.json(
      { error: "Passwort erforderlich." },
      { status: 400 }
    );
  }
  const validPassword = await verifyAdminPassword(session.user.id, adminPassword);
  if (!validPassword) {
    return NextResponse.json({ error: "Passwort ist falsch." }, { status: 401 });
  }

  const role = body.role.toUpperCase();
  if (!["USER", "ADMIN", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: body.id },
    select: { id: true, role: true, adminAccessDisabledAt: true },
  });
  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (
    existingUser.role === "ADMIN" &&
    role !== "ADMIN" &&
    !existingUser.adminAccessDisabledAt &&
    !(await ensureAnotherEnabledAdminExists(existingUser.id))
  ) {
    return NextResponse.json(
      { error: "At least one enabled admin account must remain." },
      { status: 409 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: body.id },
    data: { role: role as "USER" | "ADMIN" | "STAFF" },
    select: {
      id: true,
      role: true,
      email: true,
      adminTotpEnabledAt: true,
      adminTotpPendingSecretEncrypted: true,
      adminAccessDisabledAt: true,
      sessions: { select: { id: true } },
      devices: { select: { id: true } },
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "user.role.update",
    targetType: "user",
    targetId: updated.id,
    summary: `Set role to ${updated.role}`,
    metadata: { role: updated.role, email: updated.email },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      role: updated.role,
      email: updated.email,
      adminTotpEnabled: Boolean(updated.adminTotpEnabledAt),
      adminTotpPending: Boolean(updated.adminTotpPendingSecretEncrypted),
      adminAccessDisabledAt: updated.adminAccessDisabledAt?.toISOString() ?? null,
      sessionCount: updated.sessions.length,
      deviceCount: updated.devices.length,
    },
  });
}
