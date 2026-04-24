import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  listAdminProcurementSuppliers,
  listAdminProcurementVariantOptions,
  listAdminPurchaseOrders,
} from "@/lib/adminProcurement";
import AdminProcurementClient from "./AdminProcurementClient";

export default async function AdminProcurementPage() {
  const session = await requireAdminScope("procurement.read");
  if (!session) notFound();

  const [purchaseOrders, suppliers, variantOptions] = await Promise.all([
    listAdminPurchaseOrders(),
    listAdminProcurementSuppliers(),
    listAdminProcurementVariantOptions(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminProcurementClient
        purchaseOrders={purchaseOrders}
        suppliers={suppliers}
        userRole={session.user.role}
        variantOptions={variantOptions}
      />
    </div>
  );
}
