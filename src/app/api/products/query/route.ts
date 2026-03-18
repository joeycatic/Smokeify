import { NextResponse } from "next/server";
import { attachServerTiming, getNow } from "@/lib/perf";
import { queryProducts, type SortMode } from "@/lib/productsQuery";

const parseCsv = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumber = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(request: Request) {
  const startedAt = getNow();
  const { searchParams } = new URL(request.url);
  const sortBy = (searchParams.get("sortBy") ?? "featured") as SortMode;
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);
  const limit = Math.min(
    48,
    Math.max(1, Number(searchParams.get("limit") ?? "24") || 24),
  );

  const result = await queryProducts({
    categoryParam: searchParams.get("category") ?? "",
    manufacturerParam: searchParams.get("manufacturer") ?? "",
    categories: parseCsv(searchParams.get("categories")),
    manufacturers: parseCsv(searchParams.get("manufacturers")),
    priceMin: parseNumber(searchParams.get("priceMin")),
    priceMax: parseNumber(searchParams.get("priceMax")),
    searchQuery: searchParams.get("searchQuery") ?? "",
    sortBy,
    offset,
    limit,
  });

  return attachServerTiming(NextResponse.json(result), [
    { name: "products_query", durationMs: getNow() - startedAt, description: "listing" },
  ]);
}
