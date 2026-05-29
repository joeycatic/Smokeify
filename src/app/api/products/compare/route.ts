import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/catalog";
import { MAX_COMPARE_ITEMS } from "@/lib/storefrontKeys";

export const dynamic = "force-dynamic";

const parseIds = (value: string | null) =>
  Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_COMPARE_ITEMS);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = parseIds(searchParams.get("ids"));

  if (ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await getProductsByIds(ids);
  return NextResponse.json({ products });
}
