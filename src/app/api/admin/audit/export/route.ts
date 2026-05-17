import { adminAttachmentHeaders } from "@/lib/adminApi";
import { withAdminRoute } from "@/lib/adminRoute";
import { prisma } from "@/lib/prisma";
import {
  buildAdminAuditWhere,
  parseAdminAuditFilters,
  serializeAdminAuditCsv,
} from "@/lib/adminAudit";

export const GET = withAdminRoute(async ({ request }) => {
  const filters = parseAdminAuditFilters(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  const where = buildAdminAuditWhere(filters);

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      action: true,
      actorEmail: true,
      actorId: true,
      targetType: true,
      targetId: true,
      summary: true,
      createdAt: true,
    },
  });

  const csv = serializeAdminAuditCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: adminAttachmentHeaders("admin-audit-export.csv", "text/csv; charset=utf-8"),
  });
});
