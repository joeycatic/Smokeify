import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getNewsletterAudienceSummary } from "@/lib/adminNewsletter";
import { parseAdminStorefrontScope, storefrontScopeToStorefront } from "@/lib/storefronts";
import AdminEmailTestingClient from "./AdminEmailTestingClient";

export default async function AdminEmailTestingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("ops.read"))) notFound();
  const resolvedSearchParams = await searchParams;
  const audienceSummary = await getNewsletterAudienceSummary();
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams?.storefront);
  const initialStorefront = storefrontScopeToStorefront(storefrontScope) ?? "MAIN";

  return (
    <div className="mx-auto max-w-screen-xl px-2 py-2 text-slate-100">
      <AdminEmailTestingClient
        initialStorefront={initialStorefront}
        newsletterAudienceSummary={audienceSummary}
      />
    </div>
  );
}
