import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async () => {
    const profiles = await prisma.analyzerGuideProfile.findMany({
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
      blogSlugs?: string[];
      priority?: number;
      isActive?: boolean;
    };

    if (!body.issueKey?.trim()) {
      return adminJson({ error: "issueKey is required." }, { status: 400 });
    }

    const profile = await prisma.analyzerGuideProfile.create({
      data: {
        issueKey: body.issueKey.trim(),
        aliases: body.aliases ?? [],
        blogSlugs: body.blogSlugs ?? [],
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
