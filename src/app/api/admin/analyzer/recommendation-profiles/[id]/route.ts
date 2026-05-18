import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute(
  async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as {
      issueKey?: string;
      aliases?: string[];
      reason?: string;
      categoryHandles?: string[];
      titleTerms?: string[];
      handleTerms?: string[];
      manufacturers?: string[];
      excludeTitleTerms?: string[];
      excludeHandleTerms?: string[];
      skip?: boolean;
      priority?: number;
      isActive?: boolean;
    };

    const profile = await prisma.analyzerRecommendationProfile.update({
      where: { id: params.id },
      data: {
        issueKey: typeof body.issueKey === "string" ? body.issueKey.trim() : undefined,
        aliases: body.aliases,
        reason: typeof body.reason === "string" ? body.reason.trim() : undefined,
        categoryHandles: body.categoryHandles,
        titleTerms: body.titleTerms,
        handleTerms: body.handleTerms,
        manufacturers: body.manufacturers,
        excludeTitleTerms: body.excludeTitleTerms,
        excludeHandleTerms: body.excludeHandleTerms,
        skip: typeof body.skip === "boolean" ? body.skip : undefined,
        priority: typeof body.priority === "number" ? Math.floor(body.priority) : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      },
    });

    return adminJson({ profile });
  },
  {
    scope: "ops.write",
  },
);

export const DELETE = withAdminRoute(
  async ({ params }) => {
    await prisma.analyzerRecommendationProfile.delete({
      where: { id: params.id },
    });
    return adminJson({ ok: true });
  },
  {
    scope: "ops.write",
  },
);
