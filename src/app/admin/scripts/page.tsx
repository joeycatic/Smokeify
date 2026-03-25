import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { ADMIN_SCRIPT_DEFINITIONS } from "@/lib/adminScripts";
import AdminScriptsClient from "./AdminScriptsClient";

export default async function AdminScriptsPage() {
  if (!(await requireAdmin())) notFound();

  return <AdminScriptsClient scripts={ADMIN_SCRIPT_DEFINITIONS} />;
}
