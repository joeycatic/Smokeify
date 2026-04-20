import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { collectProductComplianceBlockers } from "@/lib/productCompliance";
import { prisma } from "@/lib/prisma";

const clampLimit = (value: string | null) => {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
};

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const status = searchParams.get("status")?.trim().toUpperCase();

  const products = await prisma.product.findMany({
    where:
      status && ["DRAFT_REVIEW", "APPROVED", "NEEDS_CHANGES", "BLOCKED"].includes(status)
        ? { complianceStatus: status as never }
        : { complianceStatus: { not: "APPROVED" } },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    include: {
      mainCategory: {
        select: {
          handle: true,
          storefronts: true,
          parent: { select: { handle: true, storefronts: true } },
        },
      },
      categories: {
        select: {
          category: {
            select: {
              handle: true,
              storefronts: true,
              parent: { select: { handle: true, storefronts: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    products: products.map((product) => {
      const blockers = collectProductComplianceBlockers(product);
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        storefronts: product.storefronts,
        complianceStatus: product.complianceStatus,
        complianceFeedEligible: product.complianceFeedEligible,
        complianceAdsEligible: product.complianceAdsEligible,
        updatedAt: product.updatedAt.toISOString(),
        blockerCount: blockers.length,
        blockers,
      };
    }),
  });
}

