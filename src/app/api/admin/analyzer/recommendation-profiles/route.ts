import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async () => {
    const profiles = await prisma.analyzerRecommendationProfile.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    return adminJson({ profiles });
  },
  {
    scope: "ops.read",
  },
);

export const POST = withAdminRoute(
  async ({ request }) => {
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

    if (!body.issueKey?.trim() || !body.reason?.trim()) {
      return adminJson({ error: "issueKey and reason are required." }, { status: 400 });
    }

    const profile = await prisma.analyzerRecommendationProfile.create({
      data: {
        issueKey: body.issueKey.trim(),
        aliases: body.aliases ?? [],
        reason: body.reason.trim(),
        categoryHandles: body.categoryHandles ?? [],
        titleTerms: body.titleTerms ?? [],
        handleTerms: body.handleTerms ?? [],
        manufacturers: body.manufacturers ?? [],
        excludeTitleTerms: body.excludeTitleTerms ?? [],
        excludeHandleTerms: body.excludeHandleTerms ?? [],
        skip: body.skip === true,
        priority: typeof body.priority === "number" ? Math.floor(body.priority) : 0,
        isActive: body.isActive !== false,
      },
    });

    return adminJson({ profile }, { status: 201 });
  },
  {
    scope: "ops.write",
  },
);
