import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async () => {
    const groups = await prisma.searchSynonymGroup.findMany({
      orderBy: [{ updatedAt: "desc" }],
    });
    return adminJson({ groups });
  },
  {
    scope: "ops.read",
  },
);

export const POST = withAdminRoute(
  async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      terms?: string[];
      storefronts?: Array<"MAIN" | "GROW">;
      isActive?: boolean;
    };

    const terms = (body.terms ?? []).map((term) => term.trim()).filter(Boolean);
    if (terms.length < 2) {
      return adminJson({ error: "At least two terms are required." }, { status: 400 });
    }

    const group = await prisma.searchSynonymGroup.create({
      data: {
        label: body.label?.trim() || null,
        terms,
        storefronts: body.storefronts ?? [],
        isActive: body.isActive !== false,
      },
    });

    return adminJson({ group }, { status: 201 });
  },
  {
    scope: "ops.write",
  },
);
