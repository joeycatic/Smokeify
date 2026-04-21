import { NextResponse } from "next/server";
import { syncAdminAlerts } from "@/lib/adminAlerts";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import {
  buildGrowvaultDiagnosticAlerts,
  getGrowvaultSharedDiagnosticsFeed,
} from "@/lib/growvaultSharedStorefront";

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

  const diagnostics = await getGrowvaultSharedDiagnosticsFeed();
  const alerts = buildGrowvaultDiagnosticAlerts(diagnostics.statuses);
  await syncAdminAlerts(alerts);

  return NextResponse.json({
    ok: true,
    generatedAt: diagnostics.generatedAt,
    alertsSynced: alerts.length,
  });
}
