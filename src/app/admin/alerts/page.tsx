import { notFound } from "next/navigation";
import AdminAlertsClient from "./AdminAlertsClient";
import { getAlertsPageData } from "@/lib/adminAddonData";
import { requireAdminScope } from "@/lib/adminCatalog";

export default async function AdminAlertsPage() {
  if (!(await requireAdminScope("alerts.read"))) notFound();

  const { alerts, assignees } = await getAlertsPageData();

  return <AdminAlertsClient initialAlerts={alerts} assignees={assignees} />;
}
