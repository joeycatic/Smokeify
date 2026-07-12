import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getSupplierImportWorkspaceData } from "@/lib/adminSupplierImport";
import SupplierImportClient from "./SupplierImportClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SupplierImportPage() {
  if (!(await requireAdminScope("catalog.write"))) notFound();

  const data = await getSupplierImportWorkspaceData();
  return (
    <div className="admin-route-frame text-[var(--adm-text)]">
      <SupplierImportClient initialData={data} />
    </div>
  );
}
