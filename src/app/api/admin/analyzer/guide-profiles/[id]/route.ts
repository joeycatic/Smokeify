import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const PATCH = withAdminRoute(
  async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as {
      issueKey?: string;
      aliases?: string[];
      blogSlugs?: string[];
      priority?: number;
      isActive?: boolean;
    };

    const profile = await prisma.analyzerGuideProfile.update({
      where: { id: params.id },
      data: {
        issueKey: typeof body.issueKey === "string" ? body.issueKey.trim() : undefined,
        aliases: body.aliases,
        blogSlugs: body.blogSlugs,
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
    await prisma.analyzerGuideProfile.delete({
      where: { id: params.id },
    });
    return adminJson({ ok: true });
  },
  {
    scope: "ops.write",
  },
);
