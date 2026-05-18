import { prisma } from "@/lib/prisma";
import { adminJson } from "@/lib/adminApi";
import {
  parseAdminReportPaymentState,
  parseAdminReportStorefront,
  parseAdminReportType,
} from "@/lib/adminReports";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";

export const POST = withAdminRoute(async ({ request, session }) => {
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    reportType?: unknown;
    days?: unknown;
    sourceStorefront?: unknown;
    paymentState?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return adminJson({ error: "Report name is required." }, { status: 400 });
  }
  const sourceStorefront = parseAdminReportStorefront(
    body.sourceStorefront as string | undefined,
  );

  const report = await prisma.adminSavedReport.create({
    data: {
      name,
      reportType: parseAdminReportType(body.reportType as string | undefined),
      days: parseAdminTimeRangeDays(body.days as string | undefined),
      sourceStorefront: sourceStorefront === "ALL" ? null : sourceStorefront,
      paymentState: parseAdminReportPaymentState(body.paymentState as string | undefined),
      createdById: session.user.id,
      createdByEmail: session.user.email ?? null,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "admin_report.create",
    targetType: "admin_saved_report",
    targetId: report.id,
    summary: `Saved report ${report.name}`,
    metadata: {
      reportType: report.reportType,
      days: report.days,
      sourceStorefront: report.sourceStorefront,
      paymentState: report.paymentState,
    },
  });

  return adminJson({ id: report.id });
});
