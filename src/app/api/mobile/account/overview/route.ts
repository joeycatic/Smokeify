import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMobileToken } from "@/lib/mobileToken";
import { getProductsByIdsAllowInactive } from "@/lib/catalog";

export async function GET(request: Request) {
  const payload = parseMobileToken(request.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, orders, wishlistItems] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        amountTotal: true,
        currency: true,
        paymentStatus: true,
        status: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.wishlistItem.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { productId: true },
    }),
  ]);

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;

  const wishlistProducts = await getProductsByIdsAllowInactive(
    wishlistItems.map((item) => item.productId),
  );

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      street: user.street ?? "",
      houseNumber: user.houseNumber ?? "",
      postalCode: user.postalCode ?? "",
      city: user.city ?? "",
      country: user.country ?? "",
    },
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      amountTotal: order.amountTotal,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      status: order.status,
      itemsCount: order._count.items,
    })),
    wishlist: wishlistProducts.map((product) => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      imageUrl: product.featuredImage?.url ?? null,
      price: product.priceRange.minVariantPrice,
    })),
  });
}
