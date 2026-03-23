import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import AdminEmailTestingClient from "./AdminEmailTestingClient";

export default async function AdminEmailTestingPage() {
  if (!(await requireAdmin())) notFound();

  return (
    <div className="mx-auto max-w-screen-xl px-2 py-2 text-slate-100">
      <AdminEmailTestingClient />
    </div>
  );
}
