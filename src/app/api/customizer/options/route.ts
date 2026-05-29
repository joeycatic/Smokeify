import { NextResponse } from "next/server";
import {
  getCustomizerOptionsByCategory,
} from "@/lib/customizerCatalog";
import { parseCustomizerOptionCategories } from "@/lib/customizerRequest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categories = parseCustomizerOptionCategories(searchParams.get("categories"));
  const options = await getCustomizerOptionsByCategory(categories);

  return NextResponse.json({
    categories,
    options,
  });
}
