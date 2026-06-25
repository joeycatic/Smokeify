import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !isCronRequestAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      headerSecret: request.headers.get("x-cron-secret"),
      expectedSecret: secret,
    })
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutomationJobNow({
    handler: "growth.welcome.run",
    scheduleKey: "growth-welcome-run",
    dedupeKey: `growth-welcome::${new Date().toISOString().slice(0, 16)}`,
    workerId: "cron-growth-welcome",
  });
  return NextResponse.json(
    result.result ? { ok: true, ...result.result.data } : { error: result.error },
    { status: result.result ? 200 : 500 },
  );
}
