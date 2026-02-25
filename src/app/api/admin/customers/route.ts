import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Registered users (USER role only — exclude admin/staff)
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      orders: {
        select: { amountTotal: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const registeredCustomers = users.map((user) => ({
    type: "registered" as const,
    id: user.id,
    email: user.email,
    name: user.name,
    joinedAt: user.createdAt.toISOString(),
    orderCount: user.orders.length,
    totalSpentCents: user.orders.reduce((sum, o) => sum + o.amountTotal, 0),
    lastOrderAt:
      user.orders.length > 0
        ? user.orders
            .map((o) => o.createdAt)
            .sort((a, b) => b.getTime() - a.getTime())[0]
            .toISOString()
        : null,
  }));

  // Guest customers: orders with no userId, grouped by customerEmail
  const guestGroups = await prisma.order.groupBy({
    by: ["customerEmail"],
    where: {
      userId: null,
      customerEmail: { not: null },
      paymentStatus: "paid",
    },
    _count: { id: true },
    _sum: { amountTotal: true },
    _max: { createdAt: true },
  });

  const guestEmails = guestGroups
    .map((g) => g.customerEmail)
    .filter((e): e is string => Boolean(e));

  // Get the shipping name from the most recent order per guest email
  const latestGuestOrders = await prisma.order.findMany({
    where: { userId: null, customerEmail: { in: guestEmails } },
    select: { customerEmail: true, shippingName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    distinct: ["customerEmail"],
  });

  const nameByEmail = new Map(
    latestGuestOrders.map((o) => [o.customerEmail, o.shippingName])
  );

  const guestCustomers = guestGroups
    .filter((g): g is typeof g & { customerEmail: string } =>
      Boolean(g.customerEmail)
    )
    .map((g) => ({
      type: "guest" as const,
      email: g.customerEmail,
      name: nameByEmail.get(g.customerEmail) ?? null,
      orderCount: g._count.id,
      totalSpentCents: g._sum.amountTotal ?? 0,
      lastOrderAt: g._max.createdAt?.toISOString() ?? null,
    }));

  return NextResponse.json({ registeredCustomers, guestCustomers });
}
