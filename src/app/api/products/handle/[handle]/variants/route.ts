import { NextResponse } from "next/server";
import { getProductByHandle } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  if (!handle) {
    return NextResponse.json({ error: "Missing product handle." }, { status: 400 });
  }

  const product = await getProductByHandle(handle);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const variants = product.variants.map((variant) => ({
    id: variant.id,
    title: variant.title,
    available: variant.availableForSale,
    options: variant.options ?? [],
  }));

  return NextResponse.json({ variants });
}
