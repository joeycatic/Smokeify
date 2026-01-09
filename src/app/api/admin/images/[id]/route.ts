import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

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
    url?: string;
    altText?: string | null;
    position?: number;
  };

  const updates: {
    url?: string;
    altText?: string | null;
    position?: number;
  } = {};

  if (typeof body.url === "string") {
    const url = body.url.trim();
    if (!url) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }
    updates.url = url;
  }

  if (typeof body.altText !== "undefined") {
    updates.altText = body.altText?.trim() || null;
  }

  if (typeof body.position === "number") {
    updates.position = body.position;
  }

  const image = await prisma.productImage.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({ image });
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

  await prisma.productImage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
