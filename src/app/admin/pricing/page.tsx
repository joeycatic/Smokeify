import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getAdminPricingOverviewSafe } from "@/lib/adminPricingServer";
import AdminPricingClient from "./AdminPricingClient";

export default async function AdminPricingPage() {
  if (!(await requireAdminScope("pricing.read"))) notFound();
  const { data, error } = await getAdminPricingOverviewSafe();

  return <AdminPricingClient initialSnapshot={data} initialError={error} />;
}
