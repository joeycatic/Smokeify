import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminCollectionsClient from "./AdminCollectionsClient";

export default async function AdminCollectionsPage() {
  if (!(await requireAdminScope("catalog.write"))) notFound();

  return (
    <div className="admin-route-frame text-slate-100">
      <AdminCollectionsClient />
    </div>
  );
}
