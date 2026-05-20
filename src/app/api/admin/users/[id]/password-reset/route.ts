import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { canAdminPerformAction } from "@/lib/adminPermissions";
import { getAppOrigin } from "@/lib/appOrigin";
import { issuePasswordResetForUser } from "@/lib/passwordReset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAdminPerformAction(session.user.role, "user.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage users." },
      { status: 403 }
    );
  }

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin:user:password-reset:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, registeredStorefront: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "This user does not have an email address." },
      { status: 400 }
    );
  }

  try {
    await issuePasswordResetForUser(
      {
        id: user.id,
        email: user.email,
        registeredStorefront: user.registeredStorefront,
      },
      { fallbackOrigin: getAppOrigin(request) }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to send password reset email." },
      { status: 500 }
    );
  }

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "user.password_reset_email_sent",
    targetType: "user",
    targetId: user.id,
    summary: `Sent password reset email to ${user.email}`,
    metadata: { email: user.email },
  });

  return NextResponse.json({ ok: true });
}
