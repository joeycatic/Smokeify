import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  listAdminProcurementSuppliers,
  listAdminProcurementVariantOptions,
  loadAdminPurchaseOrderDetail,
} from "@/lib/adminProcurement";
import AdminPurchaseOrderDetailClient from "./AdminPurchaseOrderDetailClient";

export default async function AdminPurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminScope("procurement.read");
  if (!session) notFound();

  const { id } = await params;
  const [purchaseOrder, suppliers, variantOptions] = await Promise.all([
    loadAdminPurchaseOrderDetail(id),
    listAdminProcurementSuppliers(),
    listAdminProcurementVariantOptions(),
  ]);

  if (!purchaseOrder) notFound();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminPurchaseOrderDetailClient
        purchaseOrder={purchaseOrder}
        suppliers={suppliers}
        userRole={session.user.role}
        variantOptions={variantOptions}
      />
    </div>
  );
}
