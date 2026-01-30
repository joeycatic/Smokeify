import { NextResponse } from "next/server";
import { getProductsByIdsAllowInactive } from "@/lib/catalog";

export async function POST(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  if (!Array.isArray(body.ids)) {
    return NextResponse.json([], { status: 400 });
  }

  const products = await getProductsByIdsAllowInactive(body.ids);
  return NextResponse.json(products);
}
