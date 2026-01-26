import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/adminCatalog";

type BulkPayload = {
  productIds?: string[];
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  priceAdjust?: {
    type: "percent" | "fixed";
    direction: "increase" | "decrease";
    value: number;
  };
  lowStockThreshold?: number;
  tags?: {
    add?: string[];
    remove?: string[];
  };
  category?: {
    action: "add" | "remove";
    categoryId: string;
  };
  supplierId?: string | null;
};

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as BulkPayload;
  const productIds = Array.isArray(body.productIds)
    ? body.productIds.filter(Boolean)
    : [];

  if (!productIds.length) {
    return NextResponse.json({ error: "No products selected" }, { status: 400 });
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (body.status) {
    operations.push(
      prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { status: body.status },
      })
    );
  }

  if (typeof body.lowStockThreshold === "number") {
    const threshold = Math.max(0, Math.floor(body.lowStockThreshold));
    operations.push(
      prisma.variant.updateMany({
        where: { productId: { in: productIds } },
        data: { lowStockThreshold: threshold },
      })
    );
  }

  if (body.category?.categoryId) {
    const categoryId = body.category.categoryId;
    if (body.category.action === "add") {
      operations.push(
        prisma.productCategory.createMany({
          data: productIds.map((productId, index) => ({
            productId,
            categoryId,
            position: index,
          })),
          skipDuplicates: true,
        })
      );
    } else {
      operations.push(
        prisma.productCategory.deleteMany({
          where: { productId: { in: productIds }, categoryId },
        })
      );
    }
  }

  if (typeof body.supplierId !== "undefined") {
    if (body.supplierId === null) {
      operations.push(
        prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { supplierId: null, supplier: null },
        })
      );
    } else {
      const supplier = await prisma.supplier.findUnique({
        where: { id: body.supplierId },
        select: { id: true, name: true },
      });
      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier not found" },
          { status: 400 }
        );
      }
      operations.push(
        prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { supplierId: supplier.id, supplier: supplier.name },
        })
      );
    }
  }

  if (body.tags?.add || body.tags?.remove) {
    const addTags = Array.isArray(body.tags?.add)
      ? body.tags?.add.map((tag) => tag.trim()).filter(Boolean)
      : [];
    const removeTags = Array.isArray(body.tags?.remove)
      ? body.tags?.remove.map((tag) => tag.trim()).filter(Boolean)
      : [];

    if (addTags.length || removeTags.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, tags: true },
      });
      products.forEach((product) => {
        const nextTags = new Set(product.tags ?? []);
        addTags.forEach((tag) => nextTags.add(tag));
        removeTags.forEach((tag) => nextTags.delete(tag));
        operations.push(
          prisma.product.update({
            where: { id: product.id },
            data: { tags: Array.from(nextTags) },
          })
        );
      });
    }
  }

  if (body.priceAdjust) {
    const { type, direction, value } = body.priceAdjust;
    if (Number.isFinite(value) && value > 0) {
      const multiplier = direction === "decrease" ? -1 : 1;
      const variants = await prisma.variant.findMany({
        where: { productId: { in: productIds } },
        select: { id: true, priceCents: true },
      });
      variants.forEach((variant) => {
        let nextPrice = variant.priceCents;
        if (type === "percent") {
          nextPrice = Math.round(
            variant.priceCents * (1 + (multiplier * value) / 100)
          );
        } else {
          const delta = Math.round(value * 100) * multiplier;
          nextPrice = variant.priceCents + delta;
        }
        nextPrice = Math.max(0, nextPrice);
        operations.push(
          prisma.variant.update({
            where: { id: variant.id },
            data: { priceCents: nextPrice },
          })
        );
      });
    }
  }

  if (!operations.length) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  await prisma.$transaction(operations);
  return NextResponse.json({ ok: true });
}
