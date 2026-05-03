import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getOrderAdminActionPermissions, hasAdminScope } from "@/lib/adminPermissions";
import { loadAdminOrderDetail } from "@/lib/adminOrders";
import AdminOrderDetailClient from "./AdminOrderDetailClient";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminScope("orders.read");
  if (!session) notFound();

  const { id } = await params;
  const detail = await loadAdminOrderDetail(id);
  if (!detail) notFound();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminOrderDetailClient
        detail={detail}
        actionPermissions={getOrderAdminActionPermissions(session.user.role)}
        canReplayWebhooks={hasAdminScope(session.user.role, "ops.write")}
      />
    </div>
  );
}
