import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

const normalizeOptions = (
  value: unknown
): Array<{ name: string; value: string }> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const name = typeof entry?.name === "string" ? entry.name.trim() : "";
      const optionValue =
        typeof entry?.value === "string" ? entry.value.trim() : "";
      return name && optionValue ? { name, value: optionValue } : null;
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `reorder:ip:${ip}`,
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const variantIds = order.items
    .map((item) => item.variantId)
    .filter((variantId): variantId is string => Boolean(variantId));
  if (variantIds.length === 0) {
    return NextResponse.json({
      items: [],
      addedCount: 0,
      skippedCount: order.items.length,
    });
  }

  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      inventory: { select: { quantityOnHand: true, reserved: true } },
    },
  });
  const availableByVariant = new Map(
    variants.map((variant) => [
      variant.id,
      Math.max(0, (variant.inventory?.quantityOnHand ?? 0) - (variant.inventory?.reserved ?? 0)),
    ])
  );

  const items = order.items
    .map((item) => {
      if (!item.variantId) return null;
      const available = availableByVariant.get(item.variantId) ?? 0;
      if (available <= 0) return null;
      const quantity = Math.max(1, Math.min(item.quantity, available));
      return {
        variantId: item.variantId,
        quantity,
        options: normalizeOptions(item.options),
      };
    })
    .filter(
      (
        item
      ): item is {
        variantId: string;
        quantity: number;
        options: Array<{ name: string; value: string }>;
      } => Boolean(item)
    );

  return NextResponse.json({
    items,
    addedCount: items.length,
    skippedCount: order.items.length - items.length,
  });
}
