import { prisma } from "@/lib/prisma";
import { adminJson } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { parseStorefront } from "@/lib/storefronts";

export const GET = withAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const storefront = parseStorefront(searchParams.get("storefront"));

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(storefront ? { storefronts: { has: storefront } } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
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

  return adminJson(
    products.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      manufacturer: product.manufacturer,
      storefronts: product.storefronts,
      imageUrl: product.images[0]?.url ?? null,
    })),
  );
});
