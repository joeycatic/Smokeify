import "server-only";

import {
  Prisma,
  PurchaseOrderStatus,
} from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";
import { prisma } from "@/lib/prisma";

type AdminActor = {
  id: string | null;
  email: string | null;
};

type PurchaseOrderLineInput = {
  productId: string;
  variantId: string;
  orderedQuantity: number;
  unitCostCents: number;
  note?: string | null;
};

type PurchaseOrderUpdateInput = {
  supplierId?: string;
  reference?: string | null;
  note?: string | null;
  expectedDeliveryAt?: string | null;
  items?: PurchaseOrderLineInput[];
};

type PurchaseOrderReceiptLineInput = {
  purchaseOrderItemId: string;
  quantityReceived: number;
};

export type AdminPurchaseOrderListItem = {
  id: string;
  purchaseOrderNumber: number;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  reference: string | null;
  note: string | null;
  expectedDeliveryAt: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orderedUnits: number;
  receivedUnits: number;
  openUnits: number;
};

export type AdminPurchaseOrderDetail = AdminPurchaseOrderListItem & {
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    productTitle: string;
    variantTitle: string;
    skuSnapshot: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    openQuantity: number;
    unitCostCents: number;
    note: string | null;
  }>;
  receipts: Array<{
    id: string;
    note: string | null;
    receivedAt: string;
    createdByEmail: string | null;
    reversedAt: string | null;
    reversedByEmail: string | null;
    reversalNote: string | null;
    items: Array<{
      id: string;
      purchaseOrderItemId: string;
      quantityReceived: number;
      productTitle: string;
      variantTitle: string;
    }>;
  }>;
  events: Array<{
    id: string;
    actorEmail: string | null;
    eventType: string;
    summary: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type AdminProcurementSupplierSummary = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  leadTimeDays: number | null;
  openPurchaseOrderCount: number;
  latePurchaseOrderCount: number;
  lastReceiptAt: string | null;
};

export type AdminProcurementVariantOption = {
  productId: string;
  productTitle: string;
  supplierId: string | null;
  supplierName: string | null;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  costCents: number;
};

const PURCHASE_ORDER_INCLUDE = {
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      productId: true,
      variantId: true,
      productTitle: true,
      variantTitle: true,
      skuSnapshot: true,
      orderedQuantity: true,
      receivedQuantity: true,
      unitCostCents: true,
      note: true,
    },
  },
  receipts: {
    orderBy: { receivedAt: "desc" as const },
    include: {
      items: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          purchaseOrderItemId: true,
          quantityReceived: true,
          purchaseOrderItem: {
            select: {
              productTitle: true,
              variantTitle: true,
            },
          },
        },
      },
    },
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
} satisfies Prisma.PurchaseOrderInclude;

function serializePurchaseOrder(
  purchaseOrder: Prisma.PurchaseOrderGetPayload<{ include: typeof PURCHASE_ORDER_INCLUDE }>,
): AdminPurchaseOrderDetail {
  const orderedUnits = purchaseOrder.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
  const receivedUnits = purchaseOrder.items.reduce((sum, item) => sum + item.receivedQuantity, 0);

  return {
    id: purchaseOrder.id,
    purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
    supplierId: purchaseOrder.supplierId,
    supplierName: purchaseOrder.supplier.name,
    status: purchaseOrder.status,
    reference: purchaseOrder.reference,
    note: purchaseOrder.note,
    expectedDeliveryAt: purchaseOrder.expectedDeliveryAt?.toISOString() ?? null,
    submittedAt: purchaseOrder.submittedAt?.toISOString() ?? null,
    receivedAt: purchaseOrder.receivedAt?.toISOString() ?? null,
    createdAt: purchaseOrder.createdAt.toISOString(),
    updatedAt: purchaseOrder.updatedAt.toISOString(),
    orderedUnits,
    receivedUnits,
    openUnits: Math.max(0, orderedUnits - receivedUnits),
    items: purchaseOrder.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      skuSnapshot: item.skuSnapshot,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      openQuantity: Math.max(0, item.orderedQuantity - item.receivedQuantity),
      unitCostCents: item.unitCostCents,
      note: item.note,
    })),
    receipts: purchaseOrder.receipts.map((receipt) => ({
      id: receipt.id,
      note: receipt.note,
      receivedAt: receipt.receivedAt.toISOString(),
      createdByEmail: receipt.createdByEmail,
      reversedAt: receipt.reversedAt?.toISOString() ?? null,
      reversedByEmail: receipt.reversedByEmail,
      reversalNote: receipt.reversalNote,
      items: receipt.items.map((item) => ({
        id: item.id,
        purchaseOrderItemId: item.purchaseOrderItemId,
        quantityReceived: item.quantityReceived,
        productTitle: item.purchaseOrderItem.productTitle,
        variantTitle: item.purchaseOrderItem.variantTitle,
      })),
    })),
    events: purchaseOrder.events.map((event) => ({
      id: event.id,
      actorEmail: event.actorEmail,
      eventType: event.eventType,
      summary: event.summary,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Expected delivery date is invalid.");
  }
  return date;
}

function normalizeReference(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeNote(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeQuantity(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return Math.floor(value);
}

function normalizeMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
  return Math.round(value);
}

async function resolvePurchaseOrderLines(items: PurchaseOrderLineInput[]) {
  if (!items.length) {
    throw new Error("Add at least one purchase-order line.");
  }

  const variantIds = Array.from(new Set(items.map((item) => item.variantId)));
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return items.map((item) => {
    const variant = variantById.get(item.variantId);
    if (!variant || variant.productId !== item.productId) {
      throw new Error("Purchase-order lines must reference valid product variants.");
    }

    return {
      productId: item.productId,
      variantId: item.variantId,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      skuSnapshot: variant.sku ?? null,
      orderedQuantity: normalizeQuantity(item.orderedQuantity, "Ordered quantity"),
      receivedQuantity: 0,
      unitCostCents: normalizeMoney(item.unitCostCents, "Unit cost"),
      note: normalizeNote(item.note),
    };
  });
}

async function logPurchaseOrderEvent(input: {
  tx: Prisma.TransactionClient;
  purchaseOrderId: string;
  actor: AdminActor;
  eventType: string;
  summary: string;
  note?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await input.tx.purchaseOrderEvent.create({
    data: {
      purchaseOrderId: input.purchaseOrderId,
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      eventType: input.eventType,
      summary: input.summary,
      note: input.note ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function listAdminPurchaseOrders() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: [{ updatedAt: "desc" }, { purchaseOrderNumber: "desc" }],
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        select: {
          orderedQuantity: true,
          receivedQuantity: true,
        },
      },
    },
  });

  return purchaseOrders.map((purchaseOrder) => {
    const orderedUnits = purchaseOrder.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
    const receivedUnits = purchaseOrder.items.reduce((sum, item) => sum + item.receivedQuantity, 0);

    return {
      id: purchaseOrder.id,
      purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
      supplierId: purchaseOrder.supplierId,
      supplierName: purchaseOrder.supplier.name,
      status: purchaseOrder.status,
      reference: purchaseOrder.reference,
      note: purchaseOrder.note,
      expectedDeliveryAt: purchaseOrder.expectedDeliveryAt?.toISOString() ?? null,
      submittedAt: purchaseOrder.submittedAt?.toISOString() ?? null,
      receivedAt: purchaseOrder.receivedAt?.toISOString() ?? null,
      createdAt: purchaseOrder.createdAt.toISOString(),
      updatedAt: purchaseOrder.updatedAt.toISOString(),
      orderedUnits,
      receivedUnits,
      openUnits: Math.max(0, orderedUnits - receivedUnits),
    } satisfies AdminPurchaseOrderListItem;
  });
}

export async function loadAdminPurchaseOrderDetail(id: string) {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: PURCHASE_ORDER_INCLUDE,
  });
  return purchaseOrder ? serializePurchaseOrder(purchaseOrder) : null;
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  reference?: string | null;
  note?: string | null;
  expectedDeliveryAt?: string | null;
  items: PurchaseOrderLineInput[];
  actor: AdminActor;
}) {
  const supplierId = input.supplierId.trim();
  if (!supplierId) {
    throw new Error("Choose a supplier.");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true },
  });
  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  const resolvedItems = await resolvePurchaseOrderLines(input.items);
  const expectedDeliveryAt = toDate(input.expectedDeliveryAt);

  const purchaseOrder = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        supplierId,
        reference: normalizeReference(input.reference),
        note: normalizeNote(input.note),
        expectedDeliveryAt,
        createdById: input.actor.id,
        createdByEmail: input.actor.email,
        updatedById: input.actor.id,
        updatedByEmail: input.actor.email,
        items: {
          create: resolvedItems,
        },
      },
      include: PURCHASE_ORDER_INCLUDE,
    });

    await logPurchaseOrderEvent({
      tx,
      purchaseOrderId: created.id,
      actor: input.actor,
      eventType: "purchase_order.created",
      summary: `Created purchase order #${created.purchaseOrderNumber}`,
      metadata: {
        supplierId,
        itemCount: resolvedItems.length,
      },
    });

    return created;
  });

  await logAdminAction({
    actor: input.actor,
    action: "purchase_order.create",
    targetType: "purchase_order",
    targetId: purchaseOrder.id,
    summary: `Created purchase order #${purchaseOrder.purchaseOrderNumber}`,
    metadata: {
      supplierId,
      itemCount: resolvedItems.length,
    },
  });

  return serializePurchaseOrder(purchaseOrder);
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderUpdateInput & { actor: AdminActor },
) {
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });
  if (!existing) {
    throw new Error("Purchase order not found.");
  }
  if (existing.status !== PurchaseOrderStatus.DRAFT) {
    throw new Error("Only draft purchase orders can be edited.");
  }

  const nextSupplierId = input.supplierId?.trim() || existing.supplierId;
  const supplier = await prisma.supplier.findUnique({
    where: { id: nextSupplierId },
    select: { id: true, name: true },
  });
  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  const resolvedItems = input.items ? await resolvePurchaseOrderLines(input.items) : null;
  const expectedDeliveryAt =
    typeof input.expectedDeliveryAt === "undefined"
      ? existing.expectedDeliveryAt
      : toDate(input.expectedDeliveryAt);

  const purchaseOrder = await prisma.$transaction(async (tx) => {
    if (resolvedItems) {
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });
    }

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: nextSupplierId,
        reference:
          typeof input.reference === "undefined"
            ? existing.reference
            : normalizeReference(input.reference),
        note:
          typeof input.note === "undefined" ? existing.note : normalizeNote(input.note),
        expectedDeliveryAt,
        updatedById: input.actor.id,
        updatedByEmail: input.actor.email,
        ...(resolvedItems
          ? {
              items: {
                create: resolvedItems,
              },
            }
          : {}),
      },
      include: PURCHASE_ORDER_INCLUDE,
    });

    await logPurchaseOrderEvent({
      tx,
      purchaseOrderId: updated.id,
      actor: input.actor,
      eventType: "purchase_order.updated",
      summary: `Updated purchase order #${updated.purchaseOrderNumber}`,
      metadata: {
        supplierId: nextSupplierId,
        replacedItems: Boolean(resolvedItems),
      },
    });

    return updated;
  });

  await logAdminAction({
    actor: input.actor,
    action: "purchase_order.update",
    targetType: "purchase_order",
    targetId: purchaseOrder.id,
    summary: `Updated purchase order #${purchaseOrder.purchaseOrderNumber}`,
    metadata: {
      supplierId: nextSupplierId,
      replacedItems: Boolean(resolvedItems),
    },
  });

  return serializePurchaseOrder(purchaseOrder);
}

export async function submitPurchaseOrder(id: string, actor: AdminActor) {
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });
  if (!existing) {
    throw new Error("Purchase order not found.");
  }
  if (existing.status !== PurchaseOrderStatus.DRAFT) {
    throw new Error("Only draft purchase orders can be submitted.");
  }
  if (existing.items.length === 0) {
    throw new Error("Add at least one line before submitting.");
  }

  const purchaseOrder = await prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.SUBMITTED,
        submittedAt: new Date(),
        updatedById: actor.id,
        updatedByEmail: actor.email,
      },
      include: PURCHASE_ORDER_INCLUDE,
    });

    await logPurchaseOrderEvent({
      tx,
      purchaseOrderId: updated.id,
      actor,
      eventType: "purchase_order.submitted",
      summary: `Submitted purchase order #${updated.purchaseOrderNumber}`,
    });

    return updated;
  });

  await logAdminAction({
    actor,
    action: "purchase_order.submit",
    targetType: "purchase_order",
    targetId: purchaseOrder.id,
    summary: `Submitted purchase order #${purchaseOrder.purchaseOrderNumber}`,
  });

  return serializePurchaseOrder(purchaseOrder);
}

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string;
  note?: string | null;
  lines: PurchaseOrderReceiptLineInput[];
  actor: AdminActor;
}) {
  if (!input.lines.length) {
    throw new Error("Choose at least one line to receive.");
  }

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    include: {
      items: true,
    },
  });
  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }
  if (
    purchaseOrder.status !== PurchaseOrderStatus.SUBMITTED &&
    purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
  ) {
    throw new Error("Only submitted purchase orders can be received.");
  }

  const purchaseOrderItemById = new Map(
    purchaseOrder.items.map((item) => [item.id, item]),
  );
  const normalizedLines = input.lines.map((line) => {
    const purchaseOrderItem = purchaseOrderItemById.get(line.purchaseOrderItemId);
    if (!purchaseOrderItem) {
      throw new Error("Receipt contains an unknown purchase-order line.");
    }
    const quantityReceived = normalizeQuantity(line.quantityReceived, "Received quantity");
    const remainingQuantity =
      purchaseOrderItem.orderedQuantity - purchaseOrderItem.receivedQuantity;
    if (quantityReceived > remainingQuantity) {
      throw new Error("Receipt quantity exceeds the remaining quantity on the order.");
    }
    return {
      purchaseOrderItem,
      quantityReceived,
    };
  });

  const updated = await prisma.$transaction(async (tx) => {
    const receipt = await tx.purchaseOrderReceipt.create({
      data: {
        purchaseOrderId: purchaseOrder.id,
        note: normalizeNote(input.note),
        createdById: input.actor.id,
        createdByEmail: input.actor.email,
        items: {
          create: normalizedLines.map(({ purchaseOrderItem, quantityReceived }) => ({
            purchaseOrderItemId: purchaseOrderItem.id,
            productId: purchaseOrderItem.productId,
            variantId: purchaseOrderItem.variantId,
            quantityReceived,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    for (const { purchaseOrderItem, quantityReceived } of normalizedLines) {
      await tx.purchaseOrderItem.update({
        where: { id: purchaseOrderItem.id },
        data: {
          receivedQuantity: {
            increment: quantityReceived,
          },
        },
      });

      await tx.variantInventory.upsert({
        where: { variantId: purchaseOrderItem.variantId },
        update: {
          quantityOnHand: {
            increment: quantityReceived,
          },
        },
        create: {
          variantId: purchaseOrderItem.variantId,
          quantityOnHand: quantityReceived,
        },
      });

      await tx.inventoryAdjustment.create({
        data: {
          productId: purchaseOrderItem.productId,
          variantId: purchaseOrderItem.variantId,
          quantityDelta: quantityReceived,
          reason: "purchase_order_receipt",
          sourceType: "PURCHASE_ORDER_RECEIPT",
          sourceId: receipt.id,
          actorId: input.actor.id,
          note: normalizeNote(input.note),
        },
      });
    }

    const refreshedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: purchaseOrder.id },
      select: {
        orderedQuantity: true,
        receivedQuantity: true,
      },
    });
    const allReceived = refreshedItems.every(
      (item) => item.receivedQuantity >= item.orderedQuantity,
    );
    const anyReceived = refreshedItems.some((item) => item.receivedQuantity > 0);

    await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        status: allReceived
          ? PurchaseOrderStatus.RECEIVED
          : anyReceived
            ? PurchaseOrderStatus.PARTIALLY_RECEIVED
            : purchaseOrder.status,
        receivedAt: allReceived ? new Date() : null,
        updatedById: input.actor.id,
        updatedByEmail: input.actor.email,
      },
    });

    await logPurchaseOrderEvent({
      tx,
      purchaseOrderId: purchaseOrder.id,
      actor: input.actor,
      eventType: "purchase_order.received",
      summary: `Received ${normalizedLines.length} purchase-order line(s) on #${purchaseOrder.purchaseOrderNumber}`,
      note: normalizeNote(input.note),
      metadata: {
        receiptId: receipt.id,
        lines: normalizedLines.map(({ purchaseOrderItem, quantityReceived }) => ({
          purchaseOrderItemId: purchaseOrderItem.id,
          quantityReceived,
        })),
      },
    });

    return tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrder.id },
      include: PURCHASE_ORDER_INCLUDE,
    });
  });

  await logAdminAction({
    actor: input.actor,
    action: "purchase_order.receive",
    targetType: "purchase_order",
    targetId: purchaseOrder.id,
    summary: `Received stock for purchase order #${purchaseOrder.purchaseOrderNumber}`,
    metadata: {
      lineCount: normalizedLines.length,
      note: normalizeNote(input.note),
    },
  });

  return serializePurchaseOrder(updated);
}

export async function reversePurchaseOrderReceipt(input: {
  purchaseOrderId: string;
  receiptId: string;
  note?: string | null;
  actor: AdminActor;
}) {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    select: { id: true, purchaseOrderNumber: true },
  });
  if (!purchaseOrder) {
    throw new Error("Purchase order not found.");
  }

  const receipt = await prisma.purchaseOrderReceipt.findFirst({
    where: {
      id: input.receiptId,
      purchaseOrderId: input.purchaseOrderId,
    },
    include: {
      items: {
        include: {
          purchaseOrderItem: true,
        },
      },
    },
  });
  if (!receipt) {
    throw new Error("Receipt not found.");
  }
  if (receipt.reversedAt) {
    throw new Error("Receipt has already been reversed.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of receipt.items) {
      await tx.purchaseOrderItem.update({
        where: { id: item.purchaseOrderItemId },
        data: {
          receivedQuantity: {
            decrement: item.quantityReceived,
          },
        },
      });

      await tx.variantInventory.update({
        where: { variantId: item.variantId },
        data: {
          quantityOnHand: {
            decrement: item.quantityReceived,
          },
        },
      });

      await tx.inventoryAdjustment.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: -item.quantityReceived,
          reason: "purchase_order_receipt_reversal",
          sourceType: "PURCHASE_ORDER_RECEIPT",
          sourceId: receipt.id,
          actorId: input.actor.id,
          note: normalizeNote(input.note),
        },
      });
    }

    await tx.purchaseOrderReceipt.update({
      where: { id: receipt.id },
      data: {
        reversedAt: new Date(),
        reversedById: input.actor.id,
        reversedByEmail: input.actor.email,
        reversalNote: normalizeNote(input.note),
      },
    });

    const refreshedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: input.purchaseOrderId },
      select: {
        orderedQuantity: true,
        receivedQuantity: true,
      },
    });
    const anyReceived = refreshedItems.some((item) => item.receivedQuantity > 0);
    const allReceived = refreshedItems.every(
      (item) => item.receivedQuantity >= item.orderedQuantity,
    );

    await tx.purchaseOrder.update({
      where: { id: input.purchaseOrderId },
      data: {
        status: allReceived
          ? PurchaseOrderStatus.RECEIVED
          : anyReceived
            ? PurchaseOrderStatus.PARTIALLY_RECEIVED
            : PurchaseOrderStatus.SUBMITTED,
        receivedAt: allReceived ? new Date() : null,
        updatedById: input.actor.id,
        updatedByEmail: input.actor.email,
      },
    });

    await logPurchaseOrderEvent({
      tx,
      purchaseOrderId: input.purchaseOrderId,
      actor: input.actor,
      eventType: "purchase_order.receipt_reversed",
      summary: `Reversed receipt on purchase order #${purchaseOrder.purchaseOrderNumber}`,
      note: normalizeNote(input.note),
      metadata: {
        receiptId: receipt.id,
      },
    });

    return tx.purchaseOrder.findUniqueOrThrow({
      where: { id: input.purchaseOrderId },
      include: PURCHASE_ORDER_INCLUDE,
    });
  });

  await logAdminAction({
    actor: input.actor,
    action: "purchase_order.receive.reverse",
    targetType: "purchase_order",
    targetId: input.purchaseOrderId,
    summary: `Reversed receipt for purchase order #${purchaseOrder.purchaseOrderNumber}`,
    metadata: {
      receiptId: input.receiptId,
      note: normalizeNote(input.note),
    },
  });

  return serializePurchaseOrder(updated);
}

export async function listAdminProcurementSuppliers() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      purchaseOrders: {
        select: {
          status: true,
          expectedDeliveryAt: true,
          receivedAt: true,
          receipts: {
            select: {
              receivedAt: true,
            },
          },
        },
      },
    },
  });

  const now = Date.now();

  return suppliers.map((supplier) => {
    const openPurchaseOrders = supplier.purchaseOrders.filter(
      (purchaseOrder) =>
        purchaseOrder.status === PurchaseOrderStatus.SUBMITTED ||
        purchaseOrder.status === PurchaseOrderStatus.PARTIALLY_RECEIVED,
    );
    const latePurchaseOrderCount = openPurchaseOrders.filter((purchaseOrder) => {
      if (!purchaseOrder.expectedDeliveryAt) return false;
      return purchaseOrder.expectedDeliveryAt.getTime() < now;
    }).length;
    const lastReceiptAt = supplier.purchaseOrders
      .flatMap((purchaseOrder) => purchaseOrder.receipts.map((receipt) => receipt.receivedAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      leadTimeDays: supplier.leadTimeDays,
      openPurchaseOrderCount: openPurchaseOrders.length,
      latePurchaseOrderCount,
      lastReceiptAt: lastReceiptAt?.toISOString() ?? null,
    } satisfies AdminProcurementSupplierSummary;
  });
}

export async function listAdminProcurementVariantOptions() {
  const variants = await prisma.variant.findMany({
    orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
    include: {
      product: {
        select: {
          id: true,
          title: true,
          supplierId: true,
          supplierRef: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return variants.map((variant) => ({
    productId: variant.productId,
    productTitle: variant.product.title,
    supplierId: variant.product.supplierId,
    supplierName: variant.product.supplierRef?.name ?? null,
    variantId: variant.id,
    variantTitle: variant.title,
    sku: variant.sku,
    costCents: variant.costCents,
  })) satisfies AdminProcurementVariantOption[];
}
