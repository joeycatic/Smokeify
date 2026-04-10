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
import { canAdminPerformAction } from "@/lib/adminPermissions";

type GovernanceAction =
  | "disable_admin_access"
  | "enable_admin_access"
  | "revoke_sessions"
  | "clear_trusted_devices";

function serializeUser(user: {
  id: string;
  email: string | null;
  role: "USER" | "ADMIN" | "STAFF";
  adminTotpEnabledAt: Date | null;
  adminTotpPendingSecretEncrypted: string | null;
  adminAccessDisabledAt: Date | null;
  adminAccessDisableReason: string | null;
  sessions: Array<{ id: string }>;
  devices: Array<{ id: string }>;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    adminTotpEnabled: Boolean(user.adminTotpEnabledAt),
    adminTotpPending: Boolean(user.adminTotpPendingSecretEncrypted),
    adminAccessDisabledAt: user.adminAccessDisabledAt?.toISOString() ?? null,
    adminAccessDisableReason: user.adminAccessDisableReason,
    sessionCount: user.sessions.length,
    deviceCount: user.devices.length,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-user-governance:ip:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte spater erneut versuchen." },
      { status: 429 }
    );
  }

  const session = await requireAdminOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAdminPerformAction(session.user.role, "user.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage admin accounts." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: GovernanceAction;
    adminPassword?: string;
    reason?: string;
  };
  if (!body.action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  const validPassword = await verifyAdminPassword(
    session.user.id,
    typeof body.adminPassword === "string" ? body.adminPassword : ""
  );
  if (!validPassword) {
    return NextResponse.json({ error: "Passwort ist falsch." }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      authVersion: true,
      adminTotpEnabledAt: true,
      adminTotpPendingSecretEncrypted: true,
      adminAccessDisabledAt: true,
      adminAccessDisableReason: true,
      sessions: { select: { id: true } },
      devices: { select: { id: true } },
    },
  });
  if (!existing || existing.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
  }

  const disableReason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!disableReason) {
    return NextResponse.json(
      { error: "A short reason is required for governance actions." },
      { status: 400 }
    );
  }

  if (
    body.action === "disable_admin_access" &&
    !existing.adminAccessDisabledAt &&
    !(await ensureAnotherEnabledAdminExists(existing.id))
  ) {
    return NextResponse.json(
      { error: "At least one enabled admin account must remain." },
      { status: 409 }
    );
  }

  switch (body.action) {
    case "disable_admin_access": {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          adminAccessDisabledAt: new Date(),
          adminAccessDisableReason: disableReason,
          authVersion: { increment: 1 },
          sessions: { deleteMany: {} },
          devices: { deleteMany: {} },
        },
        select: {
          id: true,
          email: true,
          role: true,
          adminTotpEnabledAt: true,
          adminTotpPendingSecretEncrypted: true,
          adminAccessDisabledAt: true,
          adminAccessDisableReason: true,
          sessions: { select: { id: true } },
          devices: { select: { id: true } },
        },
      });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "admin_account.disable",
        targetType: "user",
        targetId: updated.id,
        summary: `Disabled admin access for ${updated.email ?? updated.id}`,
        metadata: { reason: updated.adminAccessDisableReason },
      });

      return NextResponse.json({ user: serializeUser(updated) });
    }
    case "enable_admin_access": {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          adminAccessDisabledAt: null,
          adminAccessDisableReason: null,
        },
        select: {
          id: true,
          email: true,
          role: true,
          adminTotpEnabledAt: true,
          adminTotpPendingSecretEncrypted: true,
          adminAccessDisabledAt: true,
          adminAccessDisableReason: true,
          sessions: { select: { id: true } },
          devices: { select: { id: true } },
        },
      });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "admin_account.enable",
        targetType: "user",
        targetId: updated.id,
        summary: `Re-enabled admin access for ${updated.email ?? updated.id}`,
        metadata: { reason: disableReason },
      });

      return NextResponse.json({ user: serializeUser(updated) });
    }
    case "revoke_sessions": {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          authVersion: { increment: 1 },
          sessions: { deleteMany: {} },
        },
        select: {
          id: true,
          email: true,
          role: true,
          adminTotpEnabledAt: true,
          adminTotpPendingSecretEncrypted: true,
          adminAccessDisabledAt: true,
          adminAccessDisableReason: true,
          sessions: { select: { id: true } },
          devices: { select: { id: true } },
        },
      });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "admin_account.sessions_revoked",
        targetType: "user",
        targetId: updated.id,
        summary: `Revoked admin sessions for ${updated.email ?? updated.id}`,
        metadata: { reason: disableReason },
      });

      return NextResponse.json({ user: serializeUser(updated) });
    }
    case "clear_trusted_devices": {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          devices: { deleteMany: {} },
        },
        select: {
          id: true,
          email: true,
          role: true,
          adminTotpEnabledAt: true,
          adminTotpPendingSecretEncrypted: true,
          adminAccessDisabledAt: true,
          adminAccessDisableReason: true,
          sessions: { select: { id: true } },
          devices: { select: { id: true } },
        },
      });

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "admin_account.devices_cleared",
        targetType: "user",
        targetId: updated.id,
        summary: `Cleared trusted devices for ${updated.email ?? updated.id}`,
        metadata: { reason: disableReason },
      });

      return NextResponse.json({ user: serializeUser(updated) });
    }
    default: {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }
  }
}
