import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  listAdminSupportCases,
  listAdminSupportOwners,
  parseAdminSupportCaseFilters,
} from "@/lib/adminSupport";
import AdminSupportClient from "./AdminSupportClient";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("support.read"))) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseAdminSupportCaseFilters(resolvedSearchParams);

  const [supportCases, owners] = await Promise.all([
    listAdminSupportCases(filters),
    listAdminSupportOwners(),
  ]);

  return (
    <div className="w-full text-[var(--adm-text)]">
      <AdminSupportClient supportCases={supportCases} owners={owners} />
    </div>
  );
}
