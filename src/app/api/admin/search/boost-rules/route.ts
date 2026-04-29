import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(
  async () => {
    const rules = await prisma.searchBoostRule.findMany({
      orderBy: [{ boostScore: "desc" }, { updatedAt: "desc" }],
      include: {
        product: {
          select: {
            id: true,
            title: true,
            handle: true,
          },
        },
      },
    });
    return adminJson({ rules });
  },
  {
    scope: "ops.read",
  },
);

export const POST = withAdminRoute(
  async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      query?: string;
      productId?: string;
      boostScore?: number;
      storefronts?: Array<"MAIN" | "GROW">;
      isActive?: boolean;
    };

    if (!body.query?.trim() || !body.productId?.trim()) {
      return adminJson({ error: "query and productId are required." }, { status: 400 });
    }

    const rule = await prisma.searchBoostRule.create({
      data: {
        query: body.query.trim(),
        productId: body.productId.trim(),
        boostScore:
          typeof body.boostScore === "number" && Number.isFinite(body.boostScore)
            ? Math.max(1, Math.floor(body.boostScore))
            : 100,
        storefronts: body.storefronts ?? [],
        isActive: body.isActive !== false,
      },
    });

    return adminJson({ rule }, { status: 201 });
  },
  {
    scope: "ops.write",
  },
);
