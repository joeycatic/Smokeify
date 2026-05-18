import { NextResponse } from "next/server";
import { getGrowvaultSharedMerchandisingFeed } from "@/lib/growvaultSharedStorefront";

export async function GET() {
  return NextResponse.json(await getGrowvaultSharedMerchandisingFeed(), {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
