import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";

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

  const automation = await runAutomationJobNow({
    handler: "admin.report.delivery",
    scheduleKey: "admin-report-delivery",
    dedupeKey: `admin-report-delivery::${new Date().toISOString().slice(0, 13)}`,
    workerId: "cron-admin-report-delivery",
  });

  if (!automation.result) {
    return NextResponse.json(
      {
        error: automation.error ?? "Admin report delivery failed.",
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
}
