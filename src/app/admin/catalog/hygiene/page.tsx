import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  listCatalogHygieneIssues,
  parseCatalogHygieneFilters,
} from "@/lib/adminCatalogHygiene";
import AdminCatalogHygieneClient from "./AdminCatalogHygieneClient";

export default async function AdminCatalogHygienePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("catalog.read"))) notFound();

  const resolvedSearchParams = await searchParams;
  const filters = parseCatalogHygieneFilters(resolvedSearchParams);
  const data = await listCatalogHygieneIssues(filters);

  return (
    <div className="w-full text-[var(--adm-text)]">
      <AdminCatalogHygieneClient initialData={data} />
    </div>
  );
}
