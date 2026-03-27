import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  parseAdminReportPaymentState,
  parseAdminReportStorefront,
  parseAdminReportType,
} from "@/lib/adminReports";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    reportType?: unknown;
    days?: unknown;
    sourceStorefront?: unknown;
    paymentState?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Report name is required." }, { status: 400 });
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

  return NextResponse.json({ id: report.id });
}
