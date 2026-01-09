import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStatus, requireAdmin, slugify } from "@/lib/adminCatalog";

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { options: true, inventory: true },
      },
      categories: {
        orderBy: { position: "asc" },
        include: { category: true },
      },
      collections: {
        orderBy: { position: "asc" },
        include: { collection: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    handle?: string;
    description?: string | null;
    manufacturer?: string | null;
    tags?: string[];
    status?: string;
  };

  const updates: {
    title?: string;
    handle?: string;
    description?: string | null;
    manufacturer?: string | null;
    tags?: string[];
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    updates.title = title;
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
      const existing = await prisma.product.findUnique({ where: { handle } });
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

  if (typeof body.manufacturer !== "undefined") {
    updates.manufacturer = body.manufacturer?.trim() || null;
  }

  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
  }

  if (body.status) {
    updates.status = parseStatus(body.status);
  }

  const product = await prisma.product.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await Promise.resolve(context.params);
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
