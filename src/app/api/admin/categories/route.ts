import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";
import { parseStorefronts, storefrontsToPrisma } from "@/lib/storefronts";

export const GET = withAdminRoute(async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json()) as {
      name?: string;
      handle?: string;
      description?: string | null;
      parentId?: string | null;
      storefronts?: string[];
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
      storefronts: storefrontsToPrisma(parseStorefronts(body.storefronts, ["MAIN"])),
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
  },
  {
    rateLimit: {
      keyPrefix: "admin-categories",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
);
