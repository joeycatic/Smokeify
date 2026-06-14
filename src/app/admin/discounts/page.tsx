import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import AdminDiscountsClient from "./AdminDiscountsClient";

export default async function AdminDiscountsPage() {
  if (!(await requireAdminScope("discounts.manage"))) notFound();

  return (
    <div className="admin-route-frame text-slate-100">
      <AdminDiscountsClient />
    </div>
  );
}
