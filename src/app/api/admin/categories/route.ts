import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, slugify } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-categories:ip:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    handle?: string;
    description?: string | null;
    parentId?: string | null;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const handle = slugify(body.handle?.trim() || name);
  const existing = await prisma.category.findUnique({ where: { handle } });
  if (existing) {
    return NextResponse.json({ error: "Handle already exists" }, { status: 409 });
  }

  const parentId =
    typeof body.parentId === "string" ? body.parentId.trim() : null;
  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "Parent category not found" },
        { status: 400 }
      );
    }
  }

  const category = await prisma.category.create({
    data: {
      name,
      handle,
      description: body.description?.trim() || null,
      parentId: parentId || null,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "category.create",
    targetType: "category",
    targetId: category.id,
    summary: `Created category ${category.name}`,
  });

  return NextResponse.json({ category });
}
