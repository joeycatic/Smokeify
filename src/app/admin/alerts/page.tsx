import { notFound } from "next/navigation";
import AdminAlertsClient from "./AdminAlertsClient";
import { getAlertsPageData } from "@/lib/adminAddonData";
import { requireAdmin } from "@/lib/adminCatalog";

export default async function AdminAlertsPage() {
  if (!(await requireAdmin())) notFound();

  const { alerts, assignees } = await getAlertsPageData();

  return <AdminAlertsClient initialAlerts={alerts} assignees={assignees} />;
}
