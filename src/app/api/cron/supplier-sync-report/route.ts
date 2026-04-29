import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";
import {
  getSupplierSyncDailyReportDedupeKey,
  isSupplierSyncDailyReportTime,
} from "@/lib/supplierSyncDailyReport";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required." },
      { status: 500 },
    );
  }

  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  if (
    !isCronRequestAuthorized({
      authorizationHeader: authHeader,
      headerSecret,
      expectedSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isSupplierSyncDailyReportTime(now)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Outside 12:00 Europe/Berlin report window.",
    });
  }

  try {
    const automation = await runAutomationJobNow({
      handler: "supplier.stock.daily_report",
      scheduleKey: "supplier-stock-daily-report",
      dedupeKey: getSupplierSyncDailyReportDedupeKey(now),
      workerId: "cron-supplier-stock-daily-report",
    });

    if (!automation.result) {
      return NextResponse.json(
        {
          error: automation.error ?? "Supplier stock daily report failed.",
          job: automation.job,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      job: automation.job,
      ...automation.result.data,
    });
  } catch (error) {
    console.error("[cron/supplier-sync-report] automation failed:", error);
    return NextResponse.json(
      {
        error: "Supplier stock daily report failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
