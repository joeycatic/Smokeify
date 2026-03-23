import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminCollectionsClient from "./AdminCollectionsClient";

export default async function AdminCollectionsPage() {
  if (!(await requireAdmin())) notFound();

  return (
    <div className="mx-auto max-w-screen-xl px-2 py-2 text-slate-100">
      <AdminCollectionsClient />
    </div>
  );
}
