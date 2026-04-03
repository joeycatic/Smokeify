import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminPricingOverviewSafe } from "@/lib/adminPricingServer";
import AdminPricingClient from "./AdminPricingClient";

export default async function AdminPricingPage() {
  if (!(await requireAdmin())) notFound();
  const { data, error } = await getAdminPricingOverviewSafe();

  return <AdminPricingClient initialSnapshot={data} initialError={error} />;
}
