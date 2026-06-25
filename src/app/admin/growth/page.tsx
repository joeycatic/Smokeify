import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getGrowthOverviewSafe } from "@/lib/growthService";
import AdminGrowthClient from "./AdminGrowthClient";

export default async function AdminGrowthPage() {
  if (!(await requireAdminScope(["analytics.read", "marketing.read"]))) notFound();
  return <AdminGrowthClient initialOverview={await getGrowthOverviewSafe()} />;
}
