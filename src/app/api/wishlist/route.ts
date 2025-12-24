import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/shopify";

export async function POST(req: Request) {
  const body = await req.json();
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json([]);
  const products = await getProductsByIds(ids);
  return NextResponse.json(products);
}
