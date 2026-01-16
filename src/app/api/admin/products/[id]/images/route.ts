import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    url?: string;
    altText?: string | null;
    position?: number;
  };

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const image = await prisma.productImage.create({
    data: {
      productId: id,
      url,
      altText: body.altText?.trim() || null,
      position: Number(body.position) || 0,
    },
  });

  return NextResponse.json({ image });
}
