import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { isSameOrigin } from "@/lib/requestSecurity";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const VALID_GROUPS = ["NORMAL", "VIP", "WHOLESALE", "BLOCKED"] as const;
type CustomerGroup = (typeof VALID_GROUPS)[number];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const [user, recentOrders, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        role: true,
        customerGroup: true,
        notes: true,
        newsletterOptIn: true,
        newsletterOptInAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        amountTotal: true,
        createdAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetType: "user", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ user, recentOrders, auditLogs });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request.headers);
  const limit = await checkRateLimit({
    key: `admin:user:patch:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id } = await context.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Validate customerGroup
  if (
    body.customerGroup !== undefined &&
    !VALID_GROUPS.includes(body.customerGroup as CustomerGroup)
  ) {
    return NextResponse.json({ error: "Ungültige Kundengruppe." }, { status: 400 });
  }

  // Check email uniqueness
  if (
    body.email &&
    typeof body.email === "string" &&
    body.email.trim() !== existing.email
  ) {
    const taken = await prisma.user.findUnique({
      where: { email: body.email.trim() },
    });
    if (taken)
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse wird bereits verwendet." },
        { status: 409 }
      );
  }

  // Check name uniqueness (name is @unique)
  if (
    body.name &&
    typeof body.name === "string" &&
    body.name.trim() &&
    body.name.trim() !== existing.name
  ) {
    const taken = await prisma.user.findUnique({
      where: { name: body.name.trim() },
    });
    if (taken)
      return NextResponse.json(
        { error: "Dieser Nutzername wird bereits verwendet." },
        { status: 409 }
      );
  }

  // Build change diff for audit log
  const EDITABLE = [
    "email",
    "name",
    "firstName",
    "lastName",
    "street",
    "houseNumber",
    "postalCode",
    "city",
    "country",
    "customerGroup",
    "notes",
    "newsletterOptIn",
  ] as const;

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of EDITABLE) {
    const next = body[field];
    const prev = existing[field as keyof typeof existing];
    if (next !== undefined && next !== prev) {
      changes[field] = { from: prev, to: next };
    }
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

  await prisma.user.update({
    where: { id },
    data: {
      ...(body.email !== undefined ? { email: str(body.email) } : {}),
      ...(body.name !== undefined ? { name: str(body.name) } : {}),
      ...(body.firstName !== undefined ? { firstName: str(body.firstName) } : {}),
      ...(body.lastName !== undefined ? { lastName: str(body.lastName) } : {}),
      ...(body.street !== undefined ? { street: str(body.street) } : {}),
      ...(body.houseNumber !== undefined ? { houseNumber: str(body.houseNumber) } : {}),
      ...(body.postalCode !== undefined ? { postalCode: str(body.postalCode) } : {}),
      ...(body.city !== undefined ? { city: str(body.city) } : {}),
      ...(body.country !== undefined ? { country: str(body.country) } : {}),
      ...(body.customerGroup !== undefined
        ? { customerGroup: body.customerGroup as CustomerGroup }
        : {}),
      ...(body.notes !== undefined ? { notes: str(body.notes) } : {}),
      ...(body.newsletterOptIn !== undefined
        ? {
            newsletterOptIn: Boolean(body.newsletterOptIn),
            ...(Boolean(body.newsletterOptIn) && !existing.newsletterOptIn
              ? { newsletterOptInAt: new Date() }
              : {}),
          }
        : {}),
    },
  });

  if (Object.keys(changes).length > 0) {
    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? "" },
      action: "user.update",
      targetType: "user",
      targetId: id,
      summary: `Geändert: ${Object.keys(changes).join(", ")} (${existing.email ?? id})`,
      metadata: JSON.parse(JSON.stringify({ changes })),
    });
  }

  return NextResponse.json({ ok: true });
}
