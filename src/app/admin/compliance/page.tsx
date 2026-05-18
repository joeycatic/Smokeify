import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  listAdminComplianceProducts,
  parseAdminComplianceFilters,
} from "@/lib/adminCompliance";
import AdminComplianceClient from "@/components/admin/AdminComplianceClient";

export default async function AdminCompliancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("catalog.write"))) notFound();

  const resolvedSearchParams = (await searchParams) ?? {};
  const result = await listAdminComplianceProducts(
    parseAdminComplianceFilters(resolvedSearchParams),
  );

  return (
    <AdminComplianceClient
      products={result.products}
      filters={result.filters}
      hasNextPage={result.hasNextPage}
    />
  );
}
