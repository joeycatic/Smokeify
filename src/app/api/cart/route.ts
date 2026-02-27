import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import type { Cart, CartLine } from "@/lib/cart";

const COOKIE_NAME = "smokeify_cart";
const CURRENCY_CODE = "EUR";

type CartItem = {
  variantId: string;
  quantity: number;
  options?: Array<{ name: string; value: string }>;
};

const isMissingRelationError = (error: unknown, relation: string) =>
  error instanceof Error &&
  error.message.includes(`relation "${relation}" does not exist`);

const toAmount = (cents: number) => (cents / 100).toFixed(2);

const normalizeOptions = (
  options?: Array<{ name?: string | null; value?: string | null }>
): Array<{ name: string; value: string }> => {
  if (!Array.isArray(options)) return [];
  const seen = new Set<string>();
  const normalized: Array<{ name: string; value: string }> = [];
  options.forEach((opt) => {
    const name = String(opt?.name ?? "").trim();
    const value = String(opt?.value ?? "").trim();
    if (!name || !value) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({ name, value });
  });
  return normalized;
};

const serializeOptionsKey = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  const parts = options.map(
    (opt) => `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`
  );
  parts.sort();
  return parts.join("&");
};

const getLineId = (variantId: string, options?: Array<{ name: string; value: string }>) => {
  const key = serializeOptionsKey(options);
  return key ? `${variantId}::${key}` : variantId;
};

const mergeCartItems = (...lists: CartItem[][]) => {
  const merged = new Map<string, CartItem>();
  lists.forEach((items) => {
    items.forEach((item) => {
      const options = normalizeOptions(item.options);
      const key = getLineId(item.variantId, options);
      const quantity = Math.max(0, Math.floor(item.quantity));
      if (quantity <= 0) return;
      const existing = merged.get(key);
      merged.set(key, {
        variantId: item.variantId,
        options,
        quantity: (existing?.quantity ?? 0) + quantity,
      });
    });
  });
  return Array.from(merged.values());
};

const readCookieCartItems = async () => {
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
        options: normalizeOptions(item.options),
      }))
      .filter((item) => item.quantity > 0);
  } catch {
    return [];
  }
};

const writeCookieCartItems = async (items: CartItem[]) => {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(items), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
};

const readUserCartItems = async (userId: string) => {
  let rows: Array<{ variantId: string; quantity: number; options: unknown }> =
    [];
  try {
    rows = await prisma.$queryRaw<
      Array<{ variantId: string; quantity: number; options: unknown }>
    >`
      SELECT "variantId", quantity, options
      FROM "UserCartItem"
      WHERE "userId" = ${userId}
      ORDER BY "updatedAt" DESC
    `;
  } catch (error) {
    if (isMissingRelationError(error, "UserCartItem")) {
      return [];
    }
    throw error;
  }

  return rows
    .map((row) => ({
      variantId: row.variantId,
      quantity: Math.max(0, Math.floor(row.quantity)),
      options: normalizeOptions(
        Array.isArray(row.options)
          ? (row.options as Array<{ name?: string | null; value?: string | null }>)
          : undefined
      ),
    }))
    .filter((item) => item.quantity > 0);
};

const writeUserCartItems = async (userId: string, items: CartItem[]) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "UserCartItem"
        WHERE "userId" = ${userId}
      `;
      if (items.length === 0) return;

      for (const item of items) {
        const options = normalizeOptions(item.options);
        const optionsJson = options.length > 0 ? JSON.stringify(options) : null;
        await tx.$executeRaw`
          INSERT INTO "UserCartItem" (
            id,
            "userId",
            "variantId",
            quantity,
            "optionsKey",
            options,
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${userId},
            ${item.variantId},
            ${Math.max(1, Math.floor(item.quantity))},
            ${serializeOptionsKey(options)},
            CAST(${optionsJson} AS jsonb),
            NOW(),
            NOW()
          )
        `;
      }
    });
  } catch (error) {
    if (isMissingRelationError(error, "UserCartItem")) {
      return;
    }
    throw error;
  }
};

const getAvailableQuantity = (inventory: { quantityOnHand: number; reserved: number } | null) => {
  const onHand = inventory?.quantityOnHand ?? 0;
  const reserved = inventory?.reserved ?? 0;
  return Math.max(0, onHand - reserved);
};

const clampCartItemsToInventory = async (items: CartItem[]) => {
  if (items.length === 0) return [];

  const variants = await prisma.variant.findMany({
    where: { id: { in: Array.from(new Set(items.map((item) => item.variantId))) } },
    select: { id: true, inventory: { select: { quantityOnHand: true, reserved: true } } },
  });
  const availableByVariant = new Map(
    variants.map((variant) => [variant.id, getAvailableQuantity(variant.inventory)])
  );

  return items
    .map((item) => {
      const maxQty = availableByVariant.get(item.variantId) ?? 0;
      return {
        ...item,
        quantity: Math.max(0, Math.min(maxQty, Math.floor(item.quantity))),
      };
    })
    .filter((item) => item.quantity > 0);
};

const resolveCartItemsForRequest = async (userId?: string | null) => {
  const cookieItems = await readCookieCartItems();
  if (!userId) {
    return clampCartItemsToInventory(cookieItems);
  }

  const userItems = await readUserCartItems(userId);
  const merged = await clampCartItemsToInventory(mergeCartItems(userItems, cookieItems));
  await writeUserCartItems(userId, merged);
  await writeCookieCartItems([]);
  return merged;
};

const persistCartItems = async (items: CartItem[], userId?: string | null) => {
  const clamped = await clampCartItemsToInventory(items);
  if (userId) {
    await writeUserCartItems(userId, clamped);
    await writeCookieCartItems([]);
    return clamped;
  }
  await writeCookieCartItems(clamped);
  return clamped;
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
    select: {
      id: true,
      title: true,
      priceCents: true,
      options: { select: { name: true, value: true } },
      inventory: { select: { quantityOnHand: true, reserved: true } },
      product: {
        select: {
          title: true,
          handle: true,
          manufacturer: true,
          shortDescription: true,
          categories: {
            select: {
              category: {
                select: { handle: true, name: true, parentId: true },
              },
            },
          },
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { url: true, altText: true },
          },
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
    const categories =
      variant.product.categories?.map((entry) => entry.category) ?? [];
    const selectedOptions = item.options ?? [];
    const line: CartLine = {
      id: getLineId(variant.id, item.options),
      quantity: item.quantity,
      merchandise: {
        id: variant.id,
        title: variant.title,
        product: {
          title: variant.product.title,
          handle: variant.product.handle,
          manufacturer: variant.product.manufacturer ?? null,
          categories,
        },
        image: image
          ? { url: image.url, altText: image.altText }
          : null,
        shortDescription: variant.product.shortDescription ?? null,
        price: {
          amount: toAmount(variant.priceCents),
          currencyCode: CURRENCY_CODE,
        },
        options: selectedOptions,
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

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `cart:get:${ip}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const items = await resolveCartItemsForRequest(userId);
  const cart = await buildCart(items);
  return NextResponse.json(cart);
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit({
    key: `cart:post:${ip}`,
    limit: 40,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const body = await req.json();
  const action = body?.action as string;
  const items = await resolveCartItemsForRequest(userId);

  if (action === "add") {
    const variantId = String(body?.variantId ?? "");
    const quantity = Math.max(1, Math.floor(Number(body?.quantity ?? 1)));
    const selectedOptions = normalizeOptions(body?.options);
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
    const lineId = getLineId(variantId, selectedOptions);
    const existing = items.find(
      (item) => getLineId(item.variantId, item.options) === lineId
    );
    const currentQty = existing?.quantity ?? 0;
    const nextQty = Math.min(available, currentQty + quantity);
    const nextItems = items.filter(
      (item) => getLineId(item.variantId, item.options) !== lineId
    );
    if (nextQty > 0) {
      nextItems.push(
        selectedOptions.length > 0
          ? { variantId, quantity: nextQty, options: selectedOptions }
          : { variantId, quantity: nextQty }
      );
    }
    const persisted = await persistCartItems(nextItems, userId);
    return NextResponse.json(await buildCart(persisted));
  }

  if (action === "addMany") {
    const payloadItems: unknown[] = Array.isArray(body?.items) ? body.items : [];
    const requested: Array<{
      variantId: string;
      quantity: number;
      options: Array<{ name: string; value: string }>;
    }> = payloadItems
      .map((entry) => {
        const candidate = entry as {
          variantId?: unknown;
          quantity?: unknown;
          options?: Array<{ name?: string | null; value?: string | null }>;
        };
        return {
          variantId: String(candidate?.variantId ?? "").trim(),
          quantity: Math.max(1, Math.floor(Number(candidate?.quantity ?? 1))),
          options: normalizeOptions(candidate?.options),
        };
      })
      .filter((entry) => entry.variantId);

    if (requested.length === 0) {
      return NextResponse.json({ error: "Missing items" }, { status: 400 });
    }

    const variants = await prisma.variant.findMany({
      where: { id: { in: Array.from(new Set(requested.map((item) => item.variantId))) } },
      include: { inventory: true },
    });
    const availableByVariant = new Map(
      variants.map((variant) => [variant.id, getAvailableQuantity(variant.inventory)])
    );

    const nextMap = new Map<string, CartItem>();
    items.forEach((item) => {
      const key = getLineId(item.variantId, item.options);
      nextMap.set(key, { ...item, options: normalizeOptions(item.options) });
    });

    requested.forEach((entry) => {
      const key = getLineId(entry.variantId, entry.options);
      const available = availableByVariant.get(entry.variantId) ?? 0;
      if (available <= 0) return;
      const existing = nextMap.get(key);
      const currentQty = existing?.quantity ?? 0;
      const nextQty = Math.min(available, currentQty + entry.quantity);
      if (nextQty <= 0) {
        nextMap.delete(key);
        return;
      }
      nextMap.set(key, {
        variantId: entry.variantId,
        quantity: nextQty,
        options: entry.options,
      });
    });

    const persisted = await persistCartItems(Array.from(nextMap.values()), userId);
    return NextResponse.json(await buildCart(persisted));
  }

  if (action === "update") {
    const lineId = String(body?.lineId ?? "");
    const quantity = Math.max(0, Math.floor(Number(body?.quantity ?? 0)));
    if (!lineId) {
      return NextResponse.json({ error: "Missing lineId" }, { status: 400 });
    }
    const target = items.find(
      (item) => getLineId(item.variantId, item.options) === lineId
    );
    if (!target) {
      return NextResponse.json({ error: "Cart line not found" }, { status: 404 });
    }
    const variant = await prisma.variant.findUnique({
      where: { id: target.variantId },
      include: { inventory: true },
    });
    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
    const available = getAvailableQuantity(variant.inventory);
    const nextQty = Math.min(available, quantity);
    const nextItems = items.filter(
      (item) => getLineId(item.variantId, item.options) !== lineId
    );
    if (nextQty > 0) {
      nextItems.push(
        target.options && target.options.length > 0
          ? { variantId: target.variantId, quantity: nextQty, options: target.options }
          : { variantId: target.variantId, quantity: nextQty }
      );
    }
    const persisted = await persistCartItems(nextItems, userId);
    return NextResponse.json(await buildCart(persisted));
  }

  if (action === "remove") {
    const lineIds = Array.isArray(body?.lineIds)
      ? body.lineIds.map((id: string) => String(id))
      : [];
    const nextItems = items.filter(
      (item) => !lineIds.includes(getLineId(item.variantId, item.options))
    );
    const persisted = await persistCartItems(nextItems, userId);
    return NextResponse.json(await buildCart(persisted));
  }

  if (action === "clear") {
    const persisted = await persistCartItems([], userId);
    return NextResponse.json(await buildCart(persisted));
  }

  if (action === "merge") {
    const persisted = await persistCartItems(items, userId);
    return NextResponse.json(await buildCart(persisted));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
