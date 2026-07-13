import { redirect } from "next/navigation";
import {
  buildGrowvaultAnalyzerUrl,
  serializeForwardedSearchParams,
} from "@/lib/growvaultPublicStorefront";

export default async function PlantAnalyzerAliasRedirect({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = serializeForwardedSearchParams((await searchParams) ?? {});
  redirect(buildGrowvaultAnalyzerUrl(query));
}
