import "server-only";

import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAuditLog";
import type {
  AdminInventoryAdjustmentMode,
  AdminInventoryReasonCode,
} from "@/lib/adminInventoryShared";
export { isAdminInventoryReasonCode } from "@/lib/adminInventoryShared";

type AdminActor = {
  id?: string | null;
  email?: string | null;
};

type ApplyAdminInventoryAdjustmentInput = {
  variantId: string;
  mode: AdminInventoryAdjustmentMode;
  quantity: number;
  reasonCode: AdminInventoryReasonCode;
  note: string;
  sourceReference?: string | null;
  actor: AdminActor;
};

export async function applyAdminInventoryAdjustment(input: ApplyAdminInventoryAdjustmentInput) {
  const quantity = Math.trunc(input.quantity);
  if (!Number.isFinite(quantity)) {
    throw new Error("Quantity is invalid.");
  }
  if (!input.note.trim()) {
    throw new Error("A short adjustment note is required.");
  }

  const variant = await prisma.variant.findUnique({
    where: { id: input.variantId },
    include: {
      inventory: true,
      product: {
        select: {
          id: true,
          title: true,
          manufacturer: true,
        },
      },
    },
  });
  if (!variant?.product) {
    throw new Error("Variant not found.");
  }

  const beforeOnHand = variant.inventory?.quantityOnHand ?? 0;
  const reserved = variant.inventory?.reserved ?? 0;
  const desiredOnHand = input.mode === "set_on_hand" ? quantity : beforeOnHand + quantity;
  if (desiredOnHand < 0) {
    throw new Error("Inventory cannot go below zero.");
  }

  const delta = desiredOnHand - beforeOnHand;
  if (delta === 0) {
    throw new Error("This adjustment does not change inventory.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const inventory = await tx.variantInventory.upsert({
      where: { variantId: variant.id },
      update: {
        quantityOnHand: desiredOnHand,
      },
      create: {
        variantId: variant.id,
        quantityOnHand: desiredOnHand,
        reserved,
      },
    });

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        variantId: variant.id,
        productId: variant.product.id,
        actorId: input.actor.id ?? null,
        quantityDelta: delta,
        reason: input.reasonCode,
        note: input.note.trim(),
        sourceType: "ADMIN_MANUAL",
        sourceReference: input.sourceReference?.trim() || null,
      },
      include: {
        variant: {
          select: { id: true, title: true, sku: true },
        },
        product: {
          select: { id: true, title: true, manufacturer: true },
        },
      },
    });

    return {
      inventory,
      adjustment,
    };
  });

  await logAdminAction({
    actor: input.actor,
    action: "inventory.adjustment.create",
    targetType: "variant",
    targetId: variant.id,
    summary: `Adjusted ${variant.product.title} / ${variant.title}`,
    metadata: {
      mode: input.mode,
      reasonCode: input.reasonCode,
      beforeOnHand,
      afterOnHand: updated.inventory.quantityOnHand,
      delta,
      reserved,
      note: input.note.trim(),
      sourceReference: input.sourceReference?.trim() || null,
    },
  });

  return {
    variant: {
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      productId: variant.product.id,
      productTitle: variant.product.title,
      productManufacturer: variant.product.manufacturer,
    },
    inventory: {
      quantityOnHand: updated.inventory.quantityOnHand,
      reserved: updated.inventory.reserved,
      beforeOnHand,
      afterOnHand: updated.inventory.quantityOnHand,
      delta,
    },
    adjustment: updated.adjustment,
  };
}
