import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminCategoriesClient from "./AdminCategoriesClient";

export default async function AdminCategoriesPage() {
  if (!(await requireAdminScope("catalog.write"))) notFound();

  return (
    <div className="admin-route-frame text-slate-100">
      <AdminCategoriesClient />
    </div>
  );
}
