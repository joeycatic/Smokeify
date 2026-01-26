import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, slugify } from "@/lib/adminCatalog";

const buildUniqueHandle = async (base: string) => {
  let handle = base;
  let suffix = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { handle } });
    if (!existing) return handle;
    suffix += 1;
    handle = `${base}-${suffix}`;
  }
};

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { options: true },
      },
      categories: { orderBy: { position: "asc" } },
      collections: { orderBy: { position: "asc" } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseHandle = slugify(`${product.handle}-copy`);
  const handle = await buildUniqueHandle(baseHandle);

  const created = await prisma.product.create({
    data: {
      title: `${product.title} (Copy)`,
      handle,
      description: product.description,
      technicalDetails: product.technicalDetails,
      shortDescription: product.shortDescription,
      manufacturer: product.manufacturer,
      supplier: product.supplier,
      supplierId: product.supplierId,
      sellerName: product.sellerName,
      sellerUrl: product.sellerUrl,
      leadTimeDays: product.leadTimeDays,
      weightGrams: product.weightGrams,
      lengthMm: product.lengthMm,
      widthMm: product.widthMm,
      heightMm: product.heightMm,
      shippingClass: product.shippingClass,
      tags: product.tags,
      status: "DRAFT",
      images: {
        create: product.images.map((image) => ({
          url: image.url,
          altText: image.altText,
          position: image.position,
        })),
      },
      variants: {
        create: product.variants.map((variant) => ({
          title: variant.title,
          sku: null,
          priceCents: variant.priceCents,
          costCents: variant.costCents,
          lowStockThreshold: variant.lowStockThreshold,
          compareAtCents: variant.compareAtCents,
          position: variant.position,
          options: {
            create: variant.options.map((option) => ({
              name: option.name,
              value: option.value,
            })),
          },
          inventory: {
            create: {
              quantityOnHand: 0,
              reserved: 0,
            },
          },
        })),
      },
      categories: {
        create: product.categories.map((entry) => ({
          categoryId: entry.categoryId,
          position: entry.position,
        })),
      },
      collections: {
        create: product.collections.map((entry) => ({
          collectionId: entry.collectionId,
          position: entry.position,
        })),
      },
    },
    include: {
      _count: { select: { variants: true, images: true } },
    },
  });

  return NextResponse.json({
    product: {
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
