import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminCatalog";
import { loadAdminOrders } from "@/lib/adminOrders";
import { prisma } from "@/lib/prisma";
import AdminOrdersClient from "./AdminOrdersClient";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ customer?: string }>;
}) {
  if (!(await requireAdmin())) notFound();
  const resolvedSearchParams = (await searchParams) ?? {};

  const orders = await loadAdminOrders();
  const webhookFailures = await prisma.processedWebhookEvent.findMany({
    where: { status: "failed" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminOrdersClient
        initialSearchQuery={resolvedSearchParams.customer ?? ""}
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
