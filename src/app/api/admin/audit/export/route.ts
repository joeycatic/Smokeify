import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import {
  buildAdminAuditWhere,
  parseAdminAuditFilters,
  serializeAdminAuditCsv,
} from "@/lib/adminAudit";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

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
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="admin-audit-export.csv"',
      "Cache-Control": "no-store",
    },
  });
}
