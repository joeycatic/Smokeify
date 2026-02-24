import { NextResponse } from "next/server";

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
  if (authHeader !== `Bearer ${secret}` && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runSupplierSync } = await import(
    "../../../../../scripts/suppliers/syncSupplierStock.mjs"
  );

  await runSupplierSync();

  return NextResponse.json({ ok: true });
}
