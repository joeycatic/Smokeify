import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, slugify } from "@/lib/adminCatalog";

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

  return NextResponse.json({ collection });
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

  await prisma.collection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
