import { adminJson } from "@/lib/adminApi";
import { applyAdminInventoryAdjustment, isAdminInventoryReasonCode } from "@/lib/adminInventory";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async ({ request }) => {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (!query) {
      return adminJson({ variants: [] });
    }

    const variants = await prisma.variant.findMany({
      where: {
        OR: [
          { sku: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { product: { title: { contains: query, mode: "insensitive" } } },
          { product: { manufacturer: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        sku: true,
        product: {
          select: {
            id: true,
            title: true,
            manufacturer: true,
          },
        },
        inventory: {
          select: {
            quantityOnHand: true,
            reserved: true,
          },
        },
      },
    });

    return adminJson({
      variants: variants.map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        productId: variant.product.id,
        productTitle: variant.product.title,
        manufacturer: variant.product.manufacturer,
        quantityOnHand: variant.inventory?.quantityOnHand ?? 0,
        reserved: variant.inventory?.reserved ?? 0,
      })),
    });
  },
  {
    scope: "inventory.read",
  },
);

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      variantId?: string;
      mode?: "delta" | "set_on_hand";
      quantity?: number;
      reasonCode?: string;
      note?: string;
      sourceReference?: string | null;
    };

    if (!body.variantId?.trim()) {
      return adminJson({ error: "Variant is required." }, { status: 400 });
    }
    if (body.mode !== "delta" && body.mode !== "set_on_hand") {
      return adminJson({ error: "Adjustment mode is invalid." }, { status: 400 });
    }
    if (!isAdminInventoryReasonCode(body.reasonCode)) {
      return adminJson({ error: "Adjustment reason is invalid." }, { status: 400 });
    }
    if (typeof body.quantity !== "number" || !Number.isFinite(body.quantity)) {
      return adminJson({ error: "Quantity is invalid." }, { status: 400 });
    }

    try {
      const result = await applyAdminInventoryAdjustment({
        variantId: body.variantId.trim(),
        mode: body.mode,
        quantity: body.quantity,
        reasonCode: body.reasonCode,
        note: typeof body.note === "string" ? body.note : "",
        sourceReference:
          typeof body.sourceReference === "string" ? body.sourceReference : null,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson(result);
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Inventory adjustment failed." },
        { status: 400 },
      );
    }
  },
  {
    action: "inventory.adjust",
    rateLimit: {
      keyPrefix: "admin-inventory-adjust",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    },
  },
);
