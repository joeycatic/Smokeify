import "server-only";

import { Prisma, type ProductComplianceStatus, type Storefront } from "@prisma/client";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  ADMIN_COMPLIANCE_ACTIONS,
  normalizeAdminComplianceMutationInput,
  type AdminComplianceAction,
  type AdminComplianceMutationInput,
} from "@/lib/adminComplianceValidation";
import {
  PRODUCT_COMPLIANCE_STATUSES,
  collectProductComplianceBlockers,
  normalizeProductComplianceStatus,
  type ProductComplianceBlocker,
} from "@/lib/productCompliance";
import { prisma } from "@/lib/prisma";

export const ADMIN_COMPLIANCE_PAGE_SIZE = 50;

export { ADMIN_COMPLIANCE_ACTIONS, normalizeAdminComplianceMutationInput };
export type { AdminComplianceAction, AdminComplianceMutationInput };

export type AdminComplianceActor = {
  id?: string | null;
  email?: string | null;
};

export type AdminComplianceFilters = {
  q: string;
  storefront: "" | Storefront;
  status: "" | ProductComplianceStatus;
  blockerType: string;
  feedEligibility: "" | "eligible" | "blocked";
  adsEligibility: "" | "eligible" | "blocked";
  category: string;
  page: number;
};

const VALID_STOREFRONTS = new Set(["MAIN", "GROW"]);
const VALID_FEED_FILTERS = new Set(["", "eligible", "blocked"]);

const readParam = (
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
};

const uniqueStrings = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export function parseAdminComplianceFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): AdminComplianceFilters {
  const statusInput = readParam(searchParams, "status").toUpperCase();
  const storefrontInput = readParam(searchParams, "storefront").toUpperCase();
  const feedEligibility = readParam(searchParams, "feedEligibility").toLowerCase();
  const adsEligibility = readParam(searchParams, "adsEligibility").toLowerCase();
  const requestedPage = Number.parseInt(readParam(searchParams, "page"), 10);

  return {
    q: readParam(searchParams, "q"),
    storefront: VALID_STOREFRONTS.has(storefrontInput)
      ? (storefrontInput as Storefront)
      : "",
    status: PRODUCT_COMPLIANCE_STATUSES.includes(statusInput as ProductComplianceStatus)
      ? (statusInput as ProductComplianceStatus)
      : "",
    blockerType: readParam(searchParams, "blockerType").toUpperCase(),
    feedEligibility: VALID_FEED_FILTERS.has(feedEligibility)
      ? (feedEligibility as AdminComplianceFilters["feedEligibility"])
      : "",
    adsEligibility: VALID_FEED_FILTERS.has(adsEligibility)
      ? (adsEligibility as AdminComplianceFilters["adsEligibility"])
      : "",
    category: readParam(searchParams, "category"),
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

const serializeBlockers = (blockers: ProductComplianceBlocker[]) =>
  blockers.map((blocker) => ({
    type: blocker.type,
    field: blocker.field,
    reason: blocker.reason,
    ...(blocker.match ? { match: blocker.match } : {}),
  }));

const buildComplianceWhere = (filters: AdminComplianceFilters): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { handle: { contains: filters.q, mode: "insensitive" } },
        { manufacturer: { contains: filters.q, mode: "insensitive" } },
        { supplier: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.storefront) {
    and.push({ storefronts: { has: filters.storefront } });
  }

  if (filters.status) {
    and.push({ complianceStatus: filters.status });
  }

  if (filters.feedEligibility) {
    and.push({ complianceFeedEligible: filters.feedEligibility === "eligible" });
  }

  if (filters.adsEligibility) {
    and.push({ complianceAdsEligible: filters.adsEligibility === "eligible" });
  }

  if (filters.category) {
    and.push({
      OR: [
        { mainCategory: { handle: { contains: filters.category, mode: "insensitive" } } },
        {
          categories: {
            some: {
              category: {
                handle: { contains: filters.category, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  if (!filters.status && !filters.q && !filters.category) {
    and.push({
      OR: [
        { complianceStatus: { not: "APPROVED" } },
        { complianceManualBlockers: { isEmpty: false } },
        { storefronts: { has: "GROW" } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
};

const complianceProductInclude = {
  mainCategory: {
    select: {
      id: true,
      name: true,
      handle: true,
      storefronts: true,
      parent: { select: { handle: true, storefronts: true } },
    },
  },
  categories: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
          handle: true,
          storefronts: true,
          parent: { select: { handle: true, storefronts: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export async function listAdminComplianceProducts(filters: AdminComplianceFilters) {
  const pageSize = ADMIN_COMPLIANCE_PAGE_SIZE;
  const prefilterMultiplier = filters.blockerType ? 4 : 1;
  const products = await prisma.product.findMany({
    where: buildComplianceWhere(filters),
    orderBy: [{ updatedAt: "desc" }],
    skip: filters.blockerType ? 0 : (filters.page - 1) * pageSize,
    take: pageSize * prefilterMultiplier,
    include: complianceProductInclude,
  });

  const rows = products
    .map((product) => {
      const blockers = collectProductComplianceBlockers(product);
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        storefronts: product.storefronts,
        complianceStatus: normalizeProductComplianceStatus(product.complianceStatus),
        complianceOwnerId: product.complianceOwnerId,
        complianceOwnerEmail: product.complianceOwnerEmail,
        complianceReviewedAt: product.complianceReviewedAt?.toISOString() ?? null,
        complianceFeedEligible: product.complianceFeedEligible,
        complianceAdsEligible: product.complianceAdsEligible,
        complianceAgeGateRequired: product.complianceAgeGateRequired,
        complianceNotes: product.complianceNotes,
        complianceManualBlockers: product.complianceManualBlockers,
        updatedAt: product.updatedAt.toISOString(),
        mainCategory: product.mainCategory,
        blockerCount: blockers.length,
        blockers: serializeBlockers(blockers),
      };
    })
    .filter((product) =>
      filters.blockerType
        ? product.blockers.some((blocker) => blocker.type === filters.blockerType)
        : true,
    );

  return {
    products: rows.slice(0, pageSize),
    hasNextPage: filters.blockerType ? rows.length > pageSize : products.length === pageSize,
    filters,
  };
}

const appendReviewNote = (current: string | null, note: string, actor: AdminComplianceActor) => {
  const trimmed = note.trim();
  if (!trimmed) return current;
  const author = actor.email ?? actor.id ?? "admin";
  const entry = `[${new Date().toISOString()}] ${author}: ${trimmed}`;
  return [current?.trim(), entry].filter(Boolean).join("\n\n").slice(0, 8_000);
};

export async function mutateAdminComplianceProduct({
  productId,
  actor,
  input,
}: {
  productId: string;
  actor: AdminComplianceActor;
  input: AdminComplianceMutationInput;
}) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: complianceProductInclude,
  });
  if (!product) {
    return { ok: false as const, status: 404, error: "Product not found." };
  }

  const previousStatus = product.complianceStatus;
  const updates: Prisma.ProductUpdateInput = {};
  const blockersBefore = collectProductComplianceBlockers(product);
  let eventNote = input.note;

  if (input.action === "approve") {
    if (blockersBefore.length > 0 && !input.note) {
      return {
        ok: false as const,
        status: 400,
        error: "Approval with blockers requires a review note.",
        blockers: serializeBlockers(blockersBefore),
      };
    }
    updates.complianceStatus = "APPROVED";
    updates.complianceReviewedAt = new Date();
    updates.complianceReviewedBy = actor.id ? { connect: { id: actor.id } } : { disconnect: true };
  }

  if (input.action === "request_changes") {
    updates.complianceStatus = "NEEDS_CHANGES";
    updates.complianceReviewedAt = new Date();
    updates.complianceReviewedBy = actor.id ? { connect: { id: actor.id } } : { disconnect: true };
  }

  if (input.action === "block") {
    updates.complianceStatus = "BLOCKED";
    updates.complianceReviewedAt = new Date();
    updates.complianceReviewedBy = actor.id ? { connect: { id: actor.id } } : { disconnect: true };
  }

  if (input.action === "add_manual_blocker") {
    if (!input.blocker) {
      return { ok: false as const, status: 400, error: "Manual blocker is required." };
    }
    updates.complianceManualBlockers = uniqueStrings([
      ...product.complianceManualBlockers,
      input.blocker,
    ]);
    updates.complianceStatus = "BLOCKED";
    eventNote = input.note || input.blocker;
  }

  if (input.action === "clear_manual_blocker") {
    const remaining = input.blocker
      ? product.complianceManualBlockers.filter((blocker) => blocker !== input.blocker)
      : [];
    updates.complianceManualBlockers = remaining;
    eventNote = input.note || (input.blocker ? `Cleared blocker: ${input.blocker}` : "Cleared manual blockers");
  }

  if (input.action === "assign_owner") {
    const ownerId = input.ownerId ?? actor.id ?? null;
    const ownerEmail = input.ownerEmail ?? actor.email ?? null;
    updates.complianceOwner = ownerId ? { connect: { id: ownerId } } : { disconnect: true };
    updates.complianceOwnerEmail = ownerEmail;
    eventNote = input.note || (ownerEmail ? `Assigned to ${ownerEmail}` : "Cleared owner");
  }

  if (input.action === "add_review_note") {
    if (!input.note) {
      return { ok: false as const, status: 400, error: "Review note is required." };
    }
  }

  if (input.action === "set_feed_eligibility") {
    if (input.eligible === null) {
      return { ok: false as const, status: 400, error: "Feed eligibility value is required." };
    }
    updates.complianceFeedEligible = input.eligible;
  }

  if (input.action === "set_ads_eligibility") {
    if (input.eligible === null) {
      return { ok: false as const, status: 400, error: "Ads eligibility value is required." };
    }
    updates.complianceAdsEligible = input.eligible;
  }

  if (input.note) {
    updates.complianceNotes = appendReviewNote(product.complianceNotes, input.note, actor);
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updates,
    include: complianceProductInclude,
  });
  const blockersAfter = collectProductComplianceBlockers(updated);

  await prisma.productComplianceEvent.create({
    data: {
      productId,
      actorId: actor.id ?? null,
      actorEmail: actor.email ?? null,
      fromStatus: previousStatus,
      toStatus: updated.complianceStatus,
      blockers: serializeBlockers(blockersAfter),
      notes: eventNote || null,
      metadata: {
        action: input.action,
        feedEligible: updated.complianceFeedEligible,
        adsEligible: updated.complianceAdsEligible,
        ownerId: updated.complianceOwnerId,
        ownerEmail: updated.complianceOwnerEmail,
        manualBlockersBefore: product.complianceManualBlockers,
        manualBlockersAfter: updated.complianceManualBlockers,
      },
    },
  });

  await logAdminAction({
    actor,
    action: `compliance.${input.action}`,
    targetType: "product",
    targetId: productId,
    summary: `Compliance action ${input.action} on ${updated.title}`,
    metadata: {
      blockerCountBefore: blockersBefore.length,
      blockerCountAfter: blockersAfter.length,
      feedEligible: updated.complianceFeedEligible,
      adsEligible: updated.complianceAdsEligible,
      ownerEmail: updated.complianceOwnerEmail,
    },
  });

  return {
    ok: true as const,
    product: {
      id: updated.id,
      title: updated.title,
      complianceStatus: normalizeProductComplianceStatus(updated.complianceStatus),
      complianceOwnerEmail: updated.complianceOwnerEmail,
      complianceFeedEligible: updated.complianceFeedEligible,
      complianceAdsEligible: updated.complianceAdsEligible,
      complianceManualBlockers: updated.complianceManualBlockers,
      blockerCount: blockersAfter.length,
      blockers: serializeBlockers(blockersAfter),
    },
  };
}
