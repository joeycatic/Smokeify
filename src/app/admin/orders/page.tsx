import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { loadAdminOrders } from "@/lib/adminOrders";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  parseAdminStorefrontScope,
  storefrontScopeToStorefront,
} from "@/lib/storefronts";
import AdminOrdersClient from "./AdminOrdersClient";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdmin())) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams.storefront);
  const storefront = storefrontScopeToStorefront(storefrontScope);

  const orders = await loadAdminOrders(storefront);
  const webhookFailures = await prisma.processedWebhookEvent.findMany({
    where: { status: "failed" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminOrdersClient
        activeStorefrontLabel={ADMIN_STOREFRONT_SCOPE_LABELS[storefrontScope]}
        initialSearchQuery={
          Array.isArray(resolvedSearchParams.customer)
            ? resolvedSearchParams.customer[0] ?? ""
            : resolvedSearchParams.customer ?? ""
        }
        webhookFailures={webhookFailures.map((event) => ({
          id: event.id,
          eventId: event.eventId,
          type: event.type,
          status: event.status,
          createdAt: event.createdAt.toISOString(),
        }))}
        orders={orders}
      />
    </div>
  );
}
