import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getOrderAdminActionPermissions } from "@/lib/adminPermissions";
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
    <div className="w-full text-[var(--adm-text)]">
      <AdminOrderDetailClient
        detail={detail}
        actionPermissions={getOrderAdminActionPermissions(session.user.role)}
      />
    </div>
  );
}
