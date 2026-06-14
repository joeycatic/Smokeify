import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitizeHtml";
import { parseStorefronts, storefrontsToPrisma } from "@/lib/storefronts";

type BulkPayload = {
  productIds?: string[];
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  productGroup?: string | null;
  priceAdjust?: {
    type: "percent" | "fixed";
    direction: "increase" | "decrease";
    value: number;
  };
  lowStockThreshold?: number;
  tags?: {
    add?: string[];
    remove?: string[];
  };
  category?: {
    action: "add" | "remove";
    categoryId: string;
  };
  supplierId?: string | null;
  storefronts?: string[];
};

type BulkDeletePayload = {
  productIds?: string[];
  adminPassword?: string;
  reason?: string;
};

function getUniqueProductIds(productIds: string[] | undefined) {
  if (!Array.isArray(productIds)) return [];

  return Array.from(
    new Set(productIds.filter((productId): productId is string => Boolean(productId))),
  );
}

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json()) as BulkPayload;
    const productIds = getUniqueProductIds(body.productIds);

    if (!productIds.length) {
      return adminJson({ error: "No products selected" }, { status: 400 });
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (body.status) {
      operations.push(
        prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { status: body.status },
        }),
      );
    }

    if (typeof body.productGroup !== "undefined") {
      const nextGroup = body.productGroup === null ? null : sanitizePlainText(body.productGroup);
      operations.push(
        prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { productGroup: nextGroup },
        }),
      );
    }

    if (typeof body.lowStockThreshold === "number") {
      const threshold = Math.max(0, Math.floor(body.lowStockThreshold));
      operations.push(
        prisma.variant.updateMany({
          where: { productId: { in: productIds } },
          data: { lowStockThreshold: threshold },
        }),
      );
    }

    if (body.category?.categoryId) {
      const categoryId = body.category.categoryId;
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { parentId: true },
      });
      const isParentCategory = category?.parentId === null;
      if (body.category.action === "add") {
        operations.push(
          prisma.productCategory.createMany({
            data: productIds.map((productId, index) => ({
              productId,
              categoryId,
              position: index,
            })),
            skipDuplicates: true,
          }),
        );
        if (isParentCategory) {
          operations.push(
            prisma.product.updateMany({
              where: { id: { in: productIds }, mainCategoryId: null },
              data: { mainCategoryId: categoryId },
            }),
          );
        }
      } else {
        operations.push(
          prisma.productCategory.deleteMany({
            where: { productId: { in: productIds }, categoryId },
          }),
        );
        if (isParentCategory) {
          operations.push(
            prisma.product.updateMany({
              where: { id: { in: productIds }, mainCategoryId: categoryId },
              data: { mainCategoryId: null },
            }),
          );
        }
      }
    }

    if (typeof body.supplierId !== "undefined") {
      if (body.supplierId === null) {
        operations.push(
          prisma.product.updateMany({
            where: { id: { in: productIds } },
            data: { supplierId: null, supplier: null },
          }),
        );
      } else {
        const supplier = await prisma.supplier.findUnique({
          where: { id: body.supplierId },
          select: { id: true, name: true },
        });
        if (!supplier) {
          return adminJson({ error: "Supplier not found" }, { status: 400 });
        }
        operations.push(
          prisma.product.updateMany({
            where: { id: { in: productIds } },
            data: { supplierId: supplier.id, supplier: supplier.name },
          }),
        );
      }
    }

    if (typeof body.storefronts !== "undefined") {
      const storefronts = parseStorefronts(body.storefronts, []);
      if (storefronts.length === 0) {
        return adminJson(
          { error: "At least one storefront must be selected" },
          { status: 400 },
        );
      }
      operations.push(
        prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { storefronts: storefrontsToPrisma(storefronts) },
        }),
      );
    }

    if (body.tags?.add || body.tags?.remove) {
      const addTags = Array.isArray(body.tags?.add)
        ? body.tags?.add.map((tag) => tag.trim()).filter(Boolean)
        : [];
      const removeTags = Array.isArray(body.tags?.remove)
        ? body.tags?.remove.map((tag) => tag.trim()).filter(Boolean)
        : [];

      if (addTags.length || removeTags.length) {
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, tags: true },
        });
        products.forEach((product) => {
          const nextTags = new Set(product.tags ?? []);
          addTags.forEach((tag) => nextTags.add(tag));
          removeTags.forEach((tag) => nextTags.delete(tag));
          operations.push(
            prisma.product.update({
              where: { id: product.id },
              data: { tags: Array.from(nextTags) },
            }),
          );
        });
      }
    }

    if (body.priceAdjust) {
      const { type, direction, value } = body.priceAdjust;
      if (Number.isFinite(value) && value > 0) {
        const multiplier = direction === "decrease" ? -1 : 1;
        const variants = await prisma.variant.findMany({
          where: { productId: { in: productIds } },
          select: { id: true, priceCents: true },
        });
        variants.forEach((variant) => {
          let nextPrice = variant.priceCents;
          if (type === "percent") {
            nextPrice = Math.round(
              variant.priceCents * (1 + (multiplier * value) / 100),
            );
          } else {
            const delta = Math.round(value * 100) * multiplier;
            nextPrice = variant.priceCents + delta;
          }
          nextPrice = Math.max(0, nextPrice);
          operations.push(
            prisma.variant.update({
              where: { id: variant.id },
              data: { priceCents: nextPrice },
            }),
          );
        });
      }
    }

    if (!operations.length) {
      return adminJson({ error: "No changes provided" }, { status: 400 });
    }

    await prisma.$transaction(operations);
    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "product.bulk.update",
      targetType: "product",
      summary: `Bulk updated ${productIds.length} products`,
      metadata: { productIds },
    });
    return adminJson({ ok: true });
  },
  {
    action: "catalog.product.write",
    rateLimit: {
      keyPrefix: "admin-products-bulk",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      message: "Zu viele Anfragen. Bitte später erneut versuchen.",
    },
  },
);

export const DELETE = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as BulkDeletePayload;
    const productIds = getUniqueProductIds(body.productIds);
    if (!productIds.length) {
      return adminJson({ error: "No products selected" }, { status: 400 });
    }

    const adminPassword = body.adminPassword?.trim();
    if (!adminPassword) {
      return adminJson({ error: "Passwort erforderlich." }, { status: 400 });
    }

    const reason = sanitizePlainText(body.reason);
    if (!reason) {
      return adminJson({ error: "Grund für das Löschen erforderlich." }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!admin?.passwordHash) {
      return adminJson({ error: "Passwort erforderlich." }, { status: 400 });
    }

    const validPassword = await bcrypt.compare(adminPassword, admin.passwordHash);
    if (!validPassword) {
      return adminJson({ error: "Passwort ist falsch." }, { status: 401 });
    }

    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true },
    });
    if (existingProducts.length !== productIds.length) {
      return adminJson(
        { error: "One or more selected products no longer exist." },
        { status: 404 },
      );
    }

    await prisma.$transaction(
      existingProducts.map((product) =>
        prisma.product.delete({
          where: { id: product.id },
        }),
      ),
    );

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "product.bulk.delete",
      targetType: "product",
      summary: `Deleted ${productIds.length} products (${reason})`,
      metadata: {
        productIds,
        productTitles: existingProducts.map((product) => product.title),
        reason,
      },
    });

    return adminJson({ ok: true, deletedCount: productIds.length });
  },
  {
    action: "catalog.product.write",
    rateLimit: {
      keyPrefix: "admin-products-bulk-delete",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      message: "Zu viele Anfragen. Bitte später erneut versuchen.",
    },
  },
);
