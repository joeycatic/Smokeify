import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { isMissingProcurementStorageError } from "@/lib/adminStorageGuards";
import {
  listAdminProcurementSuppliers,
  listAdminProcurementVariantOptions,
  listAdminPurchaseOrders,
} from "@/lib/adminProcurement";
import AdminProcurementClient from "./AdminProcurementClient";

export default async function AdminProcurementPage() {
  const session = await requireAdminScope("procurement.read");
  if (!session) notFound();

  let procurementStorageAvailable = true;
  let purchaseOrders: Awaited<ReturnType<typeof listAdminPurchaseOrders>> = [];
  let suppliers: Awaited<ReturnType<typeof listAdminProcurementSuppliers>> = [];
  let variantOptions: Awaited<ReturnType<typeof listAdminProcurementVariantOptions>> = [];

  try {
    [purchaseOrders, suppliers, variantOptions] = await Promise.all([
      listAdminPurchaseOrders(),
      listAdminProcurementSuppliers(),
      listAdminProcurementVariantOptions(),
    ]);
  } catch (error) {
    if (!isMissingProcurementStorageError(error)) {
      throw error;
    }

    procurementStorageAvailable = false;
    variantOptions = await listAdminProcurementVariantOptions();
  }

  return (
    <div className="w-full text-[var(--adm-text)]">
      {!procurementStorageAvailable ? (
        <div className="mb-5 rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          Procurement-Storage ist in der aktuellen Datenbank noch nicht verf&uuml;gbar.
          Purchase Orders, Receipts und der Event-Log bleiben leer, bis die fehlenden
          Procurement-Migrationen angewendet wurden.
        </div>
      ) : null}
      <AdminProcurementClient
        purchaseOrders={purchaseOrders}
        suppliers={suppliers}
        userRole={session.user.role}
        variantOptions={variantOptions}
      />
    </div>
  );
}
