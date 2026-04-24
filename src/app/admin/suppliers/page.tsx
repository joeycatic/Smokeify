import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminSuppliersClient from "./AdminSuppliersClient";

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdmin())) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialSearchQuery = Array.isArray(resolvedSearchParams.query)
    ? resolvedSearchParams.query[0] ?? ""
    : resolvedSearchParams.query ?? "";

  return (
    <div className="mx-auto max-w-6xl px-2 py-2 text-stone-800">
      <AdminSuppliersClient initialSearchQuery={initialSearchQuery} />
    </div>
  );
}
