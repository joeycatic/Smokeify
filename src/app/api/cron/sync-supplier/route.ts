import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { runAutomationJobNow } from "@/lib/automationQueue";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required." },
      { status: 500 }
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

  try {
    const automation = await runAutomationJobNow({
      handler: "supplier.stock.sync",
      scheduleKey: "supplier-stock-sync",
      dedupeKey: `supplier-stock-sync::${new Date().toISOString().slice(0, 13)}`,
      workerId: "cron-supplier-stock-sync",
    });
    if (!automation.result) {
      return NextResponse.json(
        {
          error: automation.error ?? "Supplier sync failed.",
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
  } catch (err) {
    console.error("[cron/sync-supplier] automation failed:", err);
    return NextResponse.json(
      { error: "Supplier sync failed.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
