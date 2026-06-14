import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminSuppliersClient from "./AdminSuppliersClient";

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("suppliers.read"))) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialSearchQuery = Array.isArray(resolvedSearchParams.query)
    ? resolvedSearchParams.query[0] ?? ""
    : resolvedSearchParams.query ?? "";

  return (
    <div className="admin-route-frame text-slate-100">
      <AdminSuppliersClient initialSearchQuery={initialSearchQuery} />
    </div>
  );
}
