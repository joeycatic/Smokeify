import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/shopify";

export async function POST(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  if (!Array.isArray(body.ids)) {
    return NextResponse.json([], { status: 400 });
  }

  const products = await getProductsByIds(body.ids);
  return NextResponse.json(products);
}
