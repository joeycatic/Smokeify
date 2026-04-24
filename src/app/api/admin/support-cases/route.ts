import { SupportCasePriority } from "@prisma/client";
import { adminJson } from "@/lib/adminApi";
import {
  createManualSupportCase,
  listAdminSupportCases,
} from "@/lib/adminSupport";
import { withAdminRoute } from "@/lib/adminRoute";

export const GET = withAdminRoute(async () => {
  const supportCases = await listAdminSupportCases();
  return adminJson({ supportCases });
});

export const POST = withAdminRoute(
  async ({ request, session }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        linkedOrderId?: string | null;
        linkedCustomerId?: string | null;
        priority?: SupportCasePriority;
        summary?: string;
        note?: string | null;
      };

      const supportCase = await createManualSupportCase({
        linkedOrderId: body.linkedOrderId,
        linkedCustomerId: body.linkedCustomerId,
        priority: body.priority,
        summary: body.summary ?? "",
        note: body.note,
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });

      return adminJson({ supportCase }, { status: 201 });
    } catch (error) {
      return adminJson(
        { error: error instanceof Error ? error.message : "Failed to create support case." },
        { status: 400 },
      );
    }
  },
  {
    rateLimit: {
      keyPrefix: "admin-support-case-create",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    },
  },
);
