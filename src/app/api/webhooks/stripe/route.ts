import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Stripe webhooks are disabled after the Viva migration." },
    { status: 410 },
  );
}
