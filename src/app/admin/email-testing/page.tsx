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
  if (!(await requireAdminScope(["ops.read", "marketing.send"]))) notFound();
  const resolvedSearchParams = await searchParams;
  const audienceSummary = await getNewsletterAudienceSummary();
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams?.storefront);
  const initialStorefront = storefrontScopeToStorefront(storefrontScope) ?? "MAIN";

  return (
    <div className="admin-route-frame text-[var(--adm-text)]">
      <AdminEmailTestingClient
        initialStorefront={initialStorefront}
        newsletterAudienceSummary={audienceSummary}
      />
    </div>
  );
}
