import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { parseStorefront } from "@/lib/storefronts";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const storefront = parseStorefront(searchParams.get("storefront"));

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(storefront ? { storefronts: { has: storefront } } : {}),
      ...(q
        ? { title: { contains: q, mode: "insensitive" } }
        : {}),
    },
    orderBy: { title: "asc" },
    take: 10,
    select: {
      id: true,
      title: true,
      handle: true,
      manufacturer: true,
      storefronts: true,
      images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
    },
  });

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      manufacturer: p.manufacturer,
      storefronts: p.storefronts,
      imageUrl: p.images[0]?.url ?? null,
    }))
  );
}
