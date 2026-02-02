import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const requiresAuth =
    Boolean(secret) && !isVercelCron;
  if (
    requiresAuth &&
    authHeader !== `Bearer ${secret}` &&
    searchParams.get("secret") !== secret &&
    headerSecret !== secret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runSupplierSync } = await import(
    "../../../../../scripts/syncSupplierStock.mjs"
  );

  await runSupplierSync();

  return NextResponse.json({ ok: true });
}
