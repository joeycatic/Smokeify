import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BLOOMTECH_PREVIEW_ACTION = "admin.script.preview.saved";
const BLOOMTECH_PREVIEW_TARGET_TYPE = "supplier-preview";
const BLOOMTECH_PREVIEW_TARGET_ID = "bloomtech";

export type BloomtechPreviewItem = {
  sourceUrl?: string;
  title?: string;
  manufacturer?: string;
  handle?: string;
  shortDescription?: string;
  description?: string;
  technicalDetails?: string;
  gtin?: string;
  price?: number | null;
  stock?: {
    statusText?: string | null;
    quantity?: number | null;
    inStock?: boolean | null;
  };
  supplierWeight?: {
    raw?: string;
    grams?: number | null;
  };
  supplierImages?: string[];
};

export type BloomtechPreviewPayload = {
  sourceMode?: string;
  sourceUrl?: string;
  sourceCategory?: string;
  sourceProduct?: string;
  checkedLinks?: number;
  previewCount?: number;
  items: BloomtechPreviewItem[];
};

type StoredBloomtechPreviewMetadata = {
  previewPayload: BloomtechPreviewPayload;
};

function isBloomtechPreviewPayload(value: unknown): value is BloomtechPreviewPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.items);
}

export async function saveBloomtechPreviewPayload(
  payload: BloomtechPreviewPayload
) {
  await prisma.$transaction([
    prisma.adminAuditLog.deleteMany({
      where: {
        action: BLOOMTECH_PREVIEW_ACTION,
        targetType: BLOOMTECH_PREVIEW_TARGET_TYPE,
        targetId: BLOOMTECH_PREVIEW_TARGET_ID,
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        action: BLOOMTECH_PREVIEW_ACTION,
        targetType: BLOOMTECH_PREVIEW_TARGET_TYPE,
        targetId: BLOOMTECH_PREVIEW_TARGET_ID,
        summary: "Saved Bloomtech supplier preview payload",
        metadata: {
          previewPayload: payload,
        } satisfies StoredBloomtechPreviewMetadata as Prisma.InputJsonValue,
      },
    }),
  ]);
}

export async function loadLatestBloomtechPreviewPayload() {
  const entry = await prisma.adminAuditLog.findFirst({
    where: {
      action: BLOOMTECH_PREVIEW_ACTION,
      targetType: BLOOMTECH_PREVIEW_TARGET_TYPE,
      targetId: BLOOMTECH_PREVIEW_TARGET_ID,
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      metadata: true,
    },
  });

  const metadata =
    entry?.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : null;
  const payload = metadata?.previewPayload;
  if (!entry || !isBloomtechPreviewPayload(payload)) {
    return null;
  }

  return {
    payload,
    createdAt: entry.createdAt,
  };
}
