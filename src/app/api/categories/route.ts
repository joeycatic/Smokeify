import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getNavbarCategories } from "@/lib/navbarCategories";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `categories:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ categories: [] }, { status: 429 });
  }

  const categories = await getNavbarCategories();
  return NextResponse.json({ categories });
}
