import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMobileToken } from "@/lib/mobileToken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

type WishlistAction = "add" | "remove";

export async function POST(request: Request) {
  const payload = parseMobileToken(request.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-wishlist:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    productId?: string;
    action?: WishlistAction;
  };
  const productId = (body.productId ?? "").trim();
  const action: WishlistAction = body.action === "remove" ? "remove" : "add";
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  if (action === "add") {
    await prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId: payload.sub,
          productId,
        },
      },
      update: {},
      create: {
        userId: payload.sub,
        productId,
      },
    });
  } else {
    await prisma.wishlistItem.deleteMany({
      where: {
        userId: payload.sub,
        productId,
      },
    });
  }

  const wishlist = await prisma.wishlistItem.findMany({
    where: { userId: payload.sub },
    select: { productId: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({
    ok: true,
    wishlistProductIds: wishlist.map((item) => item.productId),
  });
}
