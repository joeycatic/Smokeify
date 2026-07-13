import { redirect } from "next/navigation";
import {
  buildGrowvaultCustomizerUrl,
  serializeForwardedSearchParams,
} from "@/lib/growvaultPublicStorefront";

export default async function CustomizerRedirect({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = serializeForwardedSearchParams((await searchParams) ?? {});
  redirect(buildGrowvaultCustomizerUrl(query));
}
