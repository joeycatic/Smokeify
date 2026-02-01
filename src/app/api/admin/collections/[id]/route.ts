import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, slugify } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-collection-update:ip:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    handle?: string;
    description?: string | null;
  };

  const updates: {
    name?: string;
    handle?: string;
    description?: string | null;
  } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    updates.name = name;
  }

  if (typeof body.handle === "string") {
    const handleInput = body.handle.trim();
    if (handleInput) {
      const handle = slugify(handleInput);
      if (handle === "product" && handleInput.toLowerCase() !== "product") {
        return NextResponse.json(
          { error: "Handle must include letters or numbers" },
          { status: 400 }
        );
      }
      const existing = await prisma.collection.findUnique({ where: { handle } });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Handle already exists" },
          { status: 409 }
        );
      }
      updates.handle = handle;
    }
  }

  if (typeof body.description !== "undefined") {
    updates.description = body.description?.trim() || null;
  }

  const collection = await prisma.collection.update({
    where: { id },
    data: updates,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "collection.update",
    targetType: "collection",
    targetId: id,
    summary: `Updated collection fields: ${Object.keys(updates).join(", ")}`,
    metadata: { updates },
  });

  return NextResponse.json({ collection });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-collection-delete:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    adminPassword?: string;
  };
  const adminPassword = body.adminPassword?.trim();
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!admin?.passwordHash || !adminPassword) {
    return NextResponse.json(
      { error: "Passwort erforderlich." },
      { status: 400 }
    );
  }
  const validPassword = await bcrypt.compare(adminPassword, admin.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Passwort ist falsch." }, { status: 401 });
  }

  await prisma.collection.delete({ where: { id } });
  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "collection.delete",
    targetType: "collection",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
