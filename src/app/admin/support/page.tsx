import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  listAdminSupportCases,
  listAdminSupportOwners,
} from "@/lib/adminSupport";
import AdminSupportClient from "./AdminSupportClient";

export default async function AdminSupportPage() {
  if (!(await requireAdminScope("support.read"))) notFound();

  const [supportCases, owners] = await Promise.all([
    listAdminSupportCases(),
    listAdminSupportOwners(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminSupportClient supportCases={supportCases} owners={owners} />
    </div>
  );
}
