import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Cart, CartLine } from "@/lib/cart";

const COOKIE_NAME = "smokeify_cart";
const CURRENCY_CODE = "EUR";

type CartItem = { variantId: string; quantity: number };

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const readCartItems = async () => {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return [] as CartItem[];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.variantId && Number.isFinite(item.quantity))
      .map((item) => ({
        variantId: String(item.variantId),
        quantity: Math.max(0, Math.floor(Number(item.quantity))),
      }))
      .filter((item) => item.quantity > 0);
  } catch {
    return [];
  }
};

const writeCartItems = async (items: CartItem[]) => {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(items), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
};

const buildCart = async (items: CartItem[]): Promise<Cart> => {
  if (!items.length) {
    return {
      id: "local",
      checkoutUrl: null,
      totalQuantity: 0,
      cost: {
        subtotalAmount: { amount: "0.00", currencyCode: CURRENCY_CODE },
        totalAmount: { amount: "0.00", currencyCode: CURRENCY_CODE },
      },
      lines: [],
    };
  }

  const variantIds = items.map((item) => item.variantId);
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    include: {
      inventory: true,
      product: {
        include: {
          images: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  const lines: CartLine[] = [];
  let subtotalCents = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    const variant = variantMap.get(item.variantId);
    if (!variant) return;
    const image = variant.product.images[0] ?? null;
    const line: CartLine = {
      id: variant.id,
      quantity: item.quantity,
      merchandise: {
        id: variant.id,
        title: variant.title,
        product: {
          title: variant.product.title,
          handle: variant.product.handle,
          manufacturer: variant.product.manufacturer ?? null,
        },
        image: image
          ? { url: image.url, altText: image.altText }
          : null,
        price: {
          amount: toAmount(variant.priceCents),
          currencyCode: CURRENCY_CODE,
        },
      },
    };
    lines.push(line);
    subtotalCents += variant.priceCents * item.quantity;
    totalQuantity += item.quantity;
  });

  const totalAmount = toAmount(subtotalCents);

  return {
    id: "local",
    checkoutUrl: null,
    totalQuantity,
    cost: {
      subtotalAmount: { amount: totalAmount, currencyCode: CURRENCY_CODE },
      totalAmount: { amount: totalAmount, currencyCode: CURRENCY_CODE },
    },
    lines,
  };
};

const getAvailableQuantity = (inventory: { quantityOnHand: number; reserved: number } | null) => {
  const onHand = inventory?.quantityOnHand ?? 0;
  const reserved = inventory?.reserved ?? 0;
  return Math.max(0, onHand - reserved);
};

export async function GET() {
  const items = await readCartItems();
  const cart = await buildCart(items);
  return NextResponse.json(cart);
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = body?.action as string;
  const items = await readCartItems();

  if (action === "add") {
    const variantId = String(body?.variantId ?? "");
    const quantity = Math.max(1, Math.floor(Number(body?.quantity ?? 1)));
    if (!variantId) {
      return NextResponse.json({ error: "Missing variantId" }, { status: 400 });
    }
    const variant = await prisma.variant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
    const available = getAvailableQuantity(variant.inventory);
    const existing = items.find((item) => item.variantId === variantId);
    const currentQty = existing?.quantity ?? 0;
    const nextQty = Math.min(available, currentQty + quantity);
    const nextItems = items.filter((item) => item.variantId !== variantId);
    if (nextQty > 0) {
      nextItems.push({ variantId, quantity: nextQty });
    }
    await writeCartItems(nextItems);
    return NextResponse.json(await buildCart(nextItems));
  }

  if (action === "update") {
    const lineId = String(body?.lineId ?? "");
    const quantity = Math.max(0, Math.floor(Number(body?.quantity ?? 0)));
    if (!lineId) {
      return NextResponse.json({ error: "Missing lineId" }, { status: 400 });
    }
    const variant = await prisma.variant.findUnique({
      where: { id: lineId },
      include: { inventory: true },
    });
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
    const available = getAvailableQuantity(variant.inventory);
    const nextQty = Math.min(available, quantity);
    const nextItems = items.filter((item) => item.variantId !== lineId);
    if (nextQty > 0) {
      nextItems.push({ variantId: lineId, quantity: nextQty });
    }
    await writeCartItems(nextItems);
    return NextResponse.json(await buildCart(nextItems));
  }

  if (action === "remove") {
    const lineIds = Array.isArray(body?.lineIds)
      ? body.lineIds.map((id: string) => String(id))
      : [];
    const nextItems = items.filter((item) => !lineIds.includes(item.variantId));
    await writeCartItems(nextItems);
    return NextResponse.json(await buildCart(nextItems));
  }

  if (action === "clear") {
    await writeCartItems([]);
    return NextResponse.json(await buildCart([]));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
