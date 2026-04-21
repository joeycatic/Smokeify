import { NextResponse } from "next/server";
import { buildGrowvaultAnalyzerCaseContract } from "@/lib/growvaultSharedStorefront";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const contract = await buildGrowvaultAnalyzerCaseContract(id);

  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(contract, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
