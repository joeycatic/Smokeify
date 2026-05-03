import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminCustomersClient from "./AdminCustomersClient";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("customers.read"))) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialSearchQuery = Array.isArray(resolvedSearchParams.query)
    ? resolvedSearchParams.query[0] ?? ""
    : resolvedSearchParams.query ?? "";

  return (
    <div className="mx-auto max-w-6xl px-2 py-2 text-stone-800">
      <AdminCustomersClient initialSearchQuery={initialSearchQuery} />
    </div>
  );
}
