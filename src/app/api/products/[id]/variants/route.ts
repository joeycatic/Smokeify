import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  if (!productId) {
    return NextResponse.json({ error: "Missing product id." }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: { productId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      priceCents: true,
      compareAtCents: true,
      inventory: { select: { quantityOnHand: true } },
      options: { select: { name: true, value: true } },
    },
  });

  const result = variants.map((variant) => ({
    id: variant.id,
    title: variant.title,
    priceCents: variant.priceCents,
    compareAtCents: variant.compareAtCents,
    available:
      typeof variant.inventory?.quantityOnHand === "number"
        ? variant.inventory.quantityOnHand > 0
        : true,
    options: variant.options,
  }));

  return NextResponse.json({ variants: result });
}
