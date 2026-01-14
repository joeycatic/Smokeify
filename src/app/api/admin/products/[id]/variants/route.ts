import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCents, requireAdmin } from "@/lib/adminCatalog";

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
    title?: string;
    sku?: string | null;
    priceCents?: number | string;
    costCents?: number | string;
    compareAtCents?: number | string | null;
    position?: number;
    lowStockThreshold?: number;
    options?: { name: string; value: string }[];
  };

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const priceCents = parseCents(body.priceCents);
  if (priceCents === null) {
    return NextResponse.json({ error: "Price is required" }, { status: 400 });
  }

  const costCents = parseCents(body.costCents);
  if (typeof body.costCents !== "undefined" && costCents === null) {
    return NextResponse.json({ error: "Cost is invalid" }, { status: 400 });
  }

  const compareAtCents =
    typeof body.compareAtCents === "undefined" || body.compareAtCents === null
      ? null
      : parseCents(body.compareAtCents);

  const variant = await prisma.variant.create({
    data: {
      productId: id,
      title,
      sku: body.sku?.trim() || null,
      priceCents,
      costCents: costCents ?? 0,
      compareAtCents: compareAtCents ?? null,
      position: body.position ?? 0,
      lowStockThreshold:
        typeof body.lowStockThreshold === "number"
          ? Math.max(0, Math.floor(body.lowStockThreshold))
          : 5,
      options: body.options?.length
        ? {
            createMany: {
              data: body.options
                .map((opt) => ({
                  name: opt.name.trim(),
                  value: opt.value.trim(),
                }))
                .filter((opt) => opt.name && opt.value),
            },
          }
        : undefined,
      inventory: {
        create: {
          quantityOnHand: 0,
          reserved: 0,
        },
      },
    },
    include: { options: true, inventory: true },
  });

  return NextResponse.json({ variant });
}
