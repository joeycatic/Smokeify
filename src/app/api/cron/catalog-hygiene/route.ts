import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    handler: "catalog.hygiene.scan",
    scheduleKey: "catalog-hygiene-scan",
    dedupeKey: `catalog-hygiene::${new Date().toISOString().slice(0, 10)}`,
    workerId: "cron-catalog-hygiene",
  });

  if (!automation.result) {
    return NextResponse.json(
      {
        error: automation.error ?? "Catalog hygiene scan failed.",
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
