import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronRequestAuthorized } from "@/lib/cronAuth";

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

  const now = new Date();
  const result = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lte: now } },
  });

  return NextResponse.json({
    ok: true,
    deleted: result.count,
    now: now.toISOString(),
  });
}
