import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminCategoriesClient from "./AdminCategoriesClient";

export default async function AdminCategoriesPage() {
  if (!(await requireAdmin())) notFound();

  return (
    <div className="mx-auto max-w-screen-xl px-2 py-2 text-slate-100">
      <AdminCategoriesClient />
    </div>
  );
}
