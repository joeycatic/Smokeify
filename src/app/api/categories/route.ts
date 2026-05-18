import { NextResponse } from "next/server";
import { getNavbarCategories } from "@/lib/navbarCategories";

export async function GET(request: Request) {
  const categories = await getNavbarCategories();
  const response = NextResponse.json({ categories });
  response.headers.set(
    "Cache-Control",
    "public, max-age=600, s-maxage=600, stale-while-revalidate=86400",
  );
  return response;
}
