import { redirect } from "next/navigation";
import {
  buildGrowvaultPublicUrl,
  serializeForwardedSearchParams,
} from "@/lib/growvaultPublicStorefront";

export default async function GuidesRedirect({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = serializeForwardedSearchParams((await searchParams) ?? {});
  redirect(buildGrowvaultPublicUrl("/blog", query));
}
