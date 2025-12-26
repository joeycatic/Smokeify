import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ids: [] }, { status: 401 });
  }

  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    select: { productId: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ids: items.map((item) => item.productId) });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { productId?: string };
  if (!body.productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  await prisma.wishlistItem.upsert({
    where: {
      userId_productId: {
        userId: session.user.id,
        productId: body.productId,
      },
    },
    update: {},
    create: {
      userId: session.user.id,
      productId: body.productId,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { productId?: string };
  if (!body.productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  await prisma.wishlistItem.deleteMany({
    where: {
      userId: session.user.id,
      productId: body.productId,
    },
  });

  return NextResponse.json({ ok: true });
}
