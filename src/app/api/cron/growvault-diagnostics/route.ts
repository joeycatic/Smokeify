import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";

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
    handler: "growvault.diagnostics.sync",
    scheduleKey: "growvault-diagnostics",
    dedupeKey: `growvault-diagnostics::${new Date().toISOString().slice(0, 13)}`,
    workerId: "cron-growvault-diagnostics",
  });

  if (!automation.result) {
    return NextResponse.json(
      {
        error: automation.error ?? "Growvault diagnostics sync failed.",
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
