import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CART_COOKIE_NAME } from "@/lib/storefrontKeys";

export type ServerCartItem = {
  variantId: string;
  quantity: number;
  options?: Array<{ name: string; value: string }>;
};

const isMissingRelationError = (error: unknown, relation: string) =>
  error instanceof Error &&
  error.message.includes(`relation "${relation}" does not exist`);

export const normalizeCartOptions = (
  options?: Array<{ name?: string | null; value?: string | null }>,
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

export const serializeCartOptionsKey = (
  options?: Array<{ name: string; value: string }>,
) => {
  if (!options?.length) return "";
  const parts = options.map(
    (opt) => `${encodeURIComponent(opt.name)}=${encodeURIComponent(opt.value)}`,
  );
  parts.sort();
  return parts.join("&");
};

export const getServerCartLineId = (
  variantId: string,
  options?: Array<{ name: string; value: string }>,
) => {
  const key = serializeCartOptionsKey(options);
  return key ? `${variantId}::${key}` : variantId;
};

const mergeCartItems = (...lists: ServerCartItem[][]) => {
  const merged = new Map<string, ServerCartItem>();
  lists.forEach((items) => {
    items.forEach((item) => {
      const options = normalizeCartOptions(item.options);
      const key = getServerCartLineId(item.variantId, options);
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

export const readCookieCartItems = async () => {
  const store = await cookies();
  const raw = store.get(CART_COOKIE_NAME)?.value;
  if (!raw) return [] as ServerCartItem[];
  try {
    const parsed = JSON.parse(raw) as ServerCartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.variantId && Number.isFinite(item.quantity))
      .map((item) => ({
        variantId: String(item.variantId),
        quantity: Math.max(0, Math.floor(Number(item.quantity))),
        options: normalizeCartOptions(item.options),
      }))
      .filter((item) => item.quantity > 0);
  } catch {
    return [];
  }
};

export const writeCookieCartItems = async (items: ServerCartItem[]) => {
  const store = await cookies();
  store.set(CART_COOKIE_NAME, JSON.stringify(items), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
};

export const readUserCartItems = async (userId: string) => {
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
      options: normalizeCartOptions(
        Array.isArray(row.options)
          ? (row.options as Array<{ name?: string | null; value?: string | null }>)
          : undefined,
      ),
    }))
    .filter((item) => item.quantity > 0);
};

export const writeUserCartItems = async (
  userId: string,
  items: ServerCartItem[],
) => {
  const mergedItems = mergeCartItems(items);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "UserCartItem"
        WHERE "userId" = ${userId}
      `;
      if (mergedItems.length === 0) return;

      for (const item of mergedItems) {
        const options = normalizeCartOptions(item.options);
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
            ${randomUUID()},
            ${userId},
            ${item.variantId},
            ${Math.max(1, Math.floor(item.quantity))},
            ${serializeCartOptionsKey(options)},
            CAST(${optionsJson} AS jsonb),
            NOW(),
            NOW()
          )
          ON CONFLICT ("userId", "variantId", "optionsKey")
          DO UPDATE SET
            quantity = EXCLUDED.quantity,
            options = EXCLUDED.options,
            "updatedAt" = NOW()
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

const getAvailableQuantity = (
  inventory: { quantityOnHand: number; reserved: number } | null,
) => {
  const onHand = inventory?.quantityOnHand ?? 0;
  const reserved = inventory?.reserved ?? 0;
  return Math.max(0, onHand - reserved);
};

export const clampCartItemsToInventory = async (items: ServerCartItem[]) => {
  if (items.length === 0) return [];

  const variants = await prisma.variant.findMany({
    where: { id: { in: Array.from(new Set(items.map((item) => item.variantId))) } },
    select: {
      id: true,
      inventory: { select: { quantityOnHand: true, reserved: true } },
    },
  });
  const availableByVariant = new Map(
    variants.map((variant) => [variant.id, getAvailableQuantity(variant.inventory)]),
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

export const resolveCartItemsForRequest = async (userId?: string | null) => {
  const cookieItems = await readCookieCartItems();
  if (!userId) {
    return clampCartItemsToInventory(cookieItems);
  }

  const userItems = await readUserCartItems(userId);
  const merged = await clampCartItemsToInventory(
    mergeCartItems(userItems, cookieItems),
  );
  await writeUserCartItems(userId, merged);
  await writeCookieCartItems([]);
  return merged;
};
