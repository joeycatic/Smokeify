import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminCustomersClient from "./AdminCustomersClient";

export default async function AdminCustomersPage() {
  if (!(await requireAdmin())) notFound();

  return (
    <div className="mx-auto max-w-6xl px-2 py-2 text-stone-800">
      <AdminCustomersClient />
    </div>
  );
}
