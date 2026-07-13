import { redirect } from "next/navigation";
import {
  buildGrowvaultPublicUrl,
  serializeForwardedSearchParams,
} from "@/lib/growvaultPublicStorefront";

export default async function AnalyzerCaseRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = serializeForwardedSearchParams((await searchParams) ?? {});
  redirect(
    buildGrowvaultPublicUrl(
      `/pflanzen-analyse/faelle/${encodeURIComponent(slug)}`,
      query,
    ),
  );
}
