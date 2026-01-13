import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    reason?: string;
    items?: Array<{ id: string; quantity?: number }>;
  };

  const orderId = body.orderId?.trim();
  const reason = body.reason?.trim();
  if (!orderId || !reason) {
    return NextResponse.json(
      { error: "Missing order or reason" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const existing = await prisma.returnRequest.findFirst({
    where: { orderId, userId: session.user.id, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Return request already submitted" },
      { status: 409 }
    );
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const itemMap = new Map(order.items.map((item) => [item.id, item]));
  const selected = items
    .map((item) => {
      const orderItem = itemMap.get(item.id);
      if (!orderItem) return null;
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      return {
        orderItemId: orderItem.id,
        quantity: Math.min(quantity, orderItem.quantity),
      };
    })
    .filter(Boolean) as { orderItemId: string; quantity: number }[];

  if (!selected.length) {
    return NextResponse.json(
      { error: "Select items to return" },
      { status: 400 }
    );
  }

  const created = await prisma.returnRequest.create({
    data: {
      orderId,
      userId: session.user.id,
      reason,
      items: { create: selected },
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "return_requested" },
  });

  return NextResponse.json({ request: created });
}
