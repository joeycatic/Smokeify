import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminSuppliersClient from "./AdminSuppliersClient";

export default async function AdminSuppliersPage() {
  if (!(await requireAdmin())) notFound();

  return (
    <div className="mx-auto max-w-6xl px-2 py-2 text-stone-800">
      <AdminSuppliersClient />
    </div>
  );
}
