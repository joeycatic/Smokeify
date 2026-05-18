import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { ADMIN_SCRIPT_DEFINITIONS } from "@/lib/adminScripts";
import AdminScriptsClient from "./AdminScriptsClient";

export default async function AdminScriptsPage() {
  if (!(await requireAdminScope("scripts.execute"))) notFound();

  return <AdminScriptsClient scripts={ADMIN_SCRIPT_DEFINITIONS} />;
}
