import { NextResponse } from "next/server";
import { requireAdminOnly } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import {
  buildTotpOtpAuthUrl,
  decryptSensitiveValue,
  encryptSensitiveValue,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/security";
import { verifyAdminPassword } from "@/lib/adminUserGovernance";

type MfaAction =
  | "start_enrollment"
  | "view_pending_setup"
  | "confirm_enrollment"
  | "reset_mfa";

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

function buildSetupPayload(user: { id: string; email: string | null }, secret: string) {
  const accountName = user.email?.trim() || `admin-${user.id.slice(0, 8)}`;
  return {
    accountName,
    secret,
    otpAuthUrl: buildTotpOtpAuthUrl({
      issuer: "Smokeify Admin",
      accountName,
      secret,
    }),
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
    key: `admin-user-mfa:ip:${ip}`,
    limit: 20,
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

  const body = (await request.json().catch(() => ({}))) as {
    action?: MfaAction;
    adminPassword?: string;
    code?: string;
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
      adminTotpSecretEncrypted: true,
      adminTotpPendingSecretEncrypted: true,
      adminTotpEnabledAt: true,
      adminAccessDisabledAt: true,
      adminAccessDisableReason: true,
      sessions: { select: { id: true } },
      devices: { select: { id: true } },
    },
  });
  if (!existing || existing.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
  }

  if (body.action === "start_enrollment") {
    const secret = generateTotpSecret();
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        adminTotpPendingSecretEncrypted: encryptSensitiveValue(secret),
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
      action: existing.adminTotpEnabledAt ? "admin_mfa.rotate_started" : "admin_mfa.enrollment_started",
      targetType: "user",
      targetId: updated.id,
      summary: `${existing.adminTotpEnabledAt ? "Rotated" : "Started"} MFA setup for ${updated.email ?? updated.id}`,
    });

    return NextResponse.json({
      user: serializeUser(updated),
      setup: buildSetupPayload(updated, secret),
    });
  }

  if (body.action === "view_pending_setup") {
    if (!existing.adminTotpPendingSecretEncrypted) {
      return NextResponse.json({ error: "No pending MFA setup." }, { status: 409 });
    }

    return NextResponse.json({
      user: serializeUser(existing),
      setup: buildSetupPayload(
        existing,
        decryptSensitiveValue(existing.adminTotpPendingSecretEncrypted)
      ),
    });
  }

  if (body.action === "confirm_enrollment") {
    if (!existing.adminTotpPendingSecretEncrypted) {
      return NextResponse.json({ error: "No pending MFA setup." }, { status: 409 });
    }

    const secret = decryptSensitiveValue(existing.adminTotpPendingSecretEncrypted);
    const code = typeof body.code === "string" ? body.code : "";
    if (!verifyTotpCode(secret, code, Date.now(), 2)) {
      return NextResponse.json({ error: "Authenticator code is invalid." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        adminTotpSecretEncrypted: encryptSensitiveValue(secret),
        adminTotpPendingSecretEncrypted: null,
        adminTotpEnabledAt: new Date(),
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
      action: existing.adminTotpEnabledAt ? "admin_mfa.rotated" : "admin_mfa.enabled",
      targetType: "user",
      targetId: updated.id,
      summary: `${existing.adminTotpEnabledAt ? "Completed MFA rotation" : "Enabled MFA"} for ${updated.email ?? updated.id}`,
    });

    return NextResponse.json({ user: serializeUser(updated) });
  }

  if (body.action === "reset_mfa") {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        adminTotpSecretEncrypted: null,
        adminTotpPendingSecretEncrypted: null,
        adminTotpEnabledAt: null,
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
      action: "admin_mfa.reset",
      targetType: "user",
      targetId: updated.id,
      summary: `Reset MFA for ${updated.email ?? updated.id}`,
    });

    return NextResponse.json({ user: serializeUser(updated) });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
