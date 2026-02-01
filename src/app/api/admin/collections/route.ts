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

  const collections = await prisma.collection.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-collections:ip:${ip}`,
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
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const handle = slugify(body.handle?.trim() || name);
  const existing = await prisma.collection.findUnique({ where: { handle } });
  if (existing) {
    return NextResponse.json({ error: "Handle already exists" }, { status: 409 });
  }

  const collection = await prisma.collection.create({
    data: {
      name,
      handle,
      description: body.description?.trim() || null,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "collection.create",
    targetType: "collection",
    targetId: collection.id,
    summary: `Created collection ${collection.name}`,
  });

  return NextResponse.json({ collection });
}
