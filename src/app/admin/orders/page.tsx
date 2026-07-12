import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { loadAdminOrdersPage } from "@/lib/adminOrders";
import { measureServerExecution } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import {
  parseAdminStorefrontScope,
  storefrontScopeToStorefront,
} from "@/lib/storefronts";
import AdminOrdersClient from "./AdminOrdersClient";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("orders.read"))) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};
  const storefrontScope = parseAdminStorefrontScope(resolvedSearchParams.storefront);
  const storefront = storefrontScopeToStorefront(storefrontScope);
  const initialSearchQuery = Array.isArray(resolvedSearchParams.customer)
    ? resolvedSearchParams.customer[0] ?? ""
    : resolvedSearchParams.customer ?? "";
  const page = Number(
    Array.isArray(resolvedSearchParams.page)
      ? resolvedSearchParams.page[0] ?? "1"
      : resolvedSearchParams.page ?? "1",
  );

  const [{ result: orderPage }, { result: webhookFailures }] = await Promise.all([
    measureServerExecution(`admin.orders.list.${storefrontScope.toLowerCase()}`, () =>
      loadAdminOrdersPage({
        storefront,
        searchQuery: initialSearchQuery,
        page,
      }),
    ),
    measureServerExecution("admin.orders.webhookFailures", () =>
      prisma.processedWebhookEvent.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ),
  ]);

  return (
    <div className="w-full text-[var(--adm-text)]">
      <AdminOrdersClient
        activeStorefrontScope={storefrontScope}
        initialSearchQuery={initialSearchQuery}
        orderPage={orderPage}
        webhookFailures={webhookFailures.map((event) => ({
          id: event.id,
          eventId: event.eventId,
          type: event.type,
          status: event.status,
          createdAt: event.createdAt.toISOString(),
          errorMessage: event.errorMessage ?? null,
        }))}
      />
    </div>
  );
}
