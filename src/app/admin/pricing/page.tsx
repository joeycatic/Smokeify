import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminPricingOverviewSafe } from "@/lib/adminPricingIntegration";
import AdminPricingClient from "./AdminPricingClient";

export default async function AdminPricingPage() {
  if (!(await requireAdmin())) notFound();

  const requestHeaders = await headers();
  const { data, error } = await getAdminPricingOverviewSafe({
    forwardedCookieHeader: requestHeaders.get("cookie"),
  });

  return <AdminPricingClient initialSnapshot={data} initialError={error} />;
}
