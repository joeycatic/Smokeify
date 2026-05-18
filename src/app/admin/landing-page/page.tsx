import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { loadLandingPageAdminSections } from "@/lib/landingPageConfig";
import { parseStorefront } from "@/lib/storefronts";
import AdminLandingPageClient from "./AdminLandingPageClient";

export default async function AdminLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    storefront?: string | string[];
  }>;
}) {
  if (!(await requireAdminScope("content.landing.manage"))) notFound();

  const resolvedSearchParams = await searchParams;
  const rawStorefront = Array.isArray(resolvedSearchParams?.storefront)
    ? resolvedSearchParams?.storefront[0] ?? ""
    : resolvedSearchParams?.storefront ?? "";
  const storefront = parseStorefront(rawStorefront) ?? "MAIN";
  const sections = await loadLandingPageAdminSections(storefront);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminLandingPageClient
        initialSections={sections}
        initialStorefront={storefront}
      />
    </div>
  );
}
