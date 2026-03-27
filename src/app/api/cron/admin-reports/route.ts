import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { getAppOrigin } from "@/lib/appOrigin";
import { sendResendEmail } from "@/lib/resend";
import {
  buildAdminReportDeliveryEmail,
  computeNextAdminReportDelivery,
} from "@/lib/adminReportDelivery";
import {
  getAdminReportSnapshot,
  parseAdminReportPaymentState,
  parseAdminReportStorefront,
  parseAdminReportType,
  serializeAdminReportFilters,
} from "@/lib/adminReports";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is required." }, { status: 500 });
  }

  if (
    !isCronRequestAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      headerSecret: request.headers.get("x-cron-secret"),
      expectedSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const reports = await prisma.adminSavedReport.findMany({
    where: {
      deliveryEnabled: true,
      nextDeliveryAt: { lte: now },
    },
    orderBy: { nextDeliveryAt: "asc" },
    take: 20,
  });

  const origin = getAppOrigin(request);
  const sent: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const report of reports) {
    try {
      if (
        !report.deliveryEmail ||
        !report.deliveryFrequency ||
        report.deliveryHour === null
      ) {
        throw new Error("Report schedule is incomplete.");
      }

      const filters = {
        reportType: parseAdminReportType(report.reportType),
        days: parseAdminTimeRangeDays(String(report.days)),
        sourceStorefront: parseAdminReportStorefront(report.sourceStorefront ?? "ALL"),
        paymentState: parseAdminReportPaymentState(report.paymentState),
      };
      const snapshot = await getAdminReportSnapshot(filters);
      const reportUrl = new URL(
        `/admin/reports?${new URLSearchParams(serializeAdminReportFilters(filters)).toString()}`,
        origin
      ).toString();
      const email = buildAdminReportDeliveryEmail({
        reportName: report.name,
        reportUrl,
        currency: snapshot.currency,
        revenueCents: snapshot.summary.revenue.current,
        orderCount: snapshot.summary.orders.current,
        averageOrderValueCents: snapshot.summary.averageOrderValue.current,
        customerCount: snapshot.summary.customers.current,
      });

      await sendResendEmail({
        to: report.deliveryEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await prisma.adminSavedReport.update({
        where: { id: report.id },
        data: {
          lastDeliveredAt: now,
          nextDeliveryAt: computeNextAdminReportDelivery({
            frequency: report.deliveryFrequency,
            hour: report.deliveryHour,
            weekday: report.deliveryWeekday,
            from: now,
          }),
        },
      });

      sent.push(report.id);
    } catch (error) {
      failed.push({
        id: report.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: reports.length,
    sent,
    failed,
  });
}
