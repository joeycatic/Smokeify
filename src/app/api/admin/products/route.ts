import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStatus, requireAdmin, slugify } from "@/lib/adminCatalog";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { variants: true, images: true } },
    },
  });

  return NextResponse.json({
    products: products.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
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

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const handleInput = body.handle?.trim();
  const handleSource = handleInput || title;
  const baseHandle = slugify(handleSource);
  if (
    handleInput &&
    baseHandle === "product" &&
    handleInput.toLowerCase() !== "product"
  ) {
    return NextResponse.json(
      { error: "Handle must include letters or numbers" },
      { status: 400 }
    );
  }
  let handle = baseHandle;
  let suffix = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { handle } });
    if (!existing) break;
    if (handleInput) {
      return NextResponse.json(
        { error: "Handle already exists" },
        { status: 409 }
      );
    }
    suffix += 1;
    handle = `${baseHandle}-${suffix}`;
  }

  const product = await prisma.product.create({
    data: {
      title,
      handle,
      description: body.description?.trim() || null,
      manufacturer: body.manufacturer?.trim() || null,
      tags: Array.isArray(body.tags)
        ? body.tags.map((tag) => tag.trim()).filter(Boolean)
        : [],
      status: parseStatus(body.status),
      variants: {
        create: {
          title: "Default",
          priceCents: 0,
          position: 0,
          inventory: {
            create: {
              quantityOnHand: 0,
              reserved: 0,
            },
          },
        },
      },
    },
    include: {
      _count: { select: { variants: true, images: true } },
    },
  });

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
  });
}
