import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";

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
    const { runSupplierSync } = await import("@/lib/supplierStockSync.mjs");
    const result = await runSupplierSync({ prisma });
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      processed: result.processed,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
    });
  } catch (err) {
    console.error("[cron/sync-supplier] runSupplierSync failed:", err);
    return NextResponse.json(
      { error: "Supplier sync failed.", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
